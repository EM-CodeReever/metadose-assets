import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { fieldDefinition } from '$lib/server/db/schema';
import { allocateSlot, backfillSlot, slotFamilyFor } from './slotAllocator';
import { logActivity } from './activityLog';

export const FIELD_DATA_TYPES = ['text', 'number', 'date', 'boolean', 'select', 'user_reference', 'reference'] as const;
export type FieldDataType = (typeof FIELD_DATA_TYPES)[number];

/** Derives a machine-safe camelCase key from a human label, e.g. "Serial Number" -> "serialNumber". */
function keyFromLabel(label: string): string {
	const camel = label
		.trim()
		.replace(/[^a-zA-Z0-9]+(.)?/g, (_, chr: string | undefined) => (chr ? chr.toUpperCase() : ''))
		.replace(/^[A-Z]/, (chr) => chr.toLowerCase())
		.replace(/[^a-zA-Z0-9]/g, '');
	return camel || 'field';
}

function slugifyOptionValue(label: string): string {
	return (
		label
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/(^_|_$)/g, '') || 'option'
	);
}

/** Parses a select field's options textarea (one label per line) into {value, label} pairs. */
export function parseSelectOptionsInput(raw: string): { value: string; label: string }[] {
	const seen = new Set<string>();
	return raw
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((label) => {
			const base = slugifyOptionValue(label);
			let value = base;
			let suffix = 1;
			while (seen.has(value)) {
				suffix += 1;
				value = `${base}_${suffix}`;
			}
			seen.add(value);
			return { value, label };
		});
}

export async function createFieldDefinition(params: {
	organizationId: string;
	objectTypeId: string;
	label: string;
	dataType: FieldDataType;
	required?: boolean;
	selectOptions?: { value: string; label: string }[];
	actorUserId: string;
}) {
	const existing = await db.query.fieldDefinition.findMany({
		where: eq(fieldDefinition.objectTypeId, params.objectTypeId)
	});

	const base = keyFromLabel(params.label);
	const usedKeys = new Set(existing.map((f) => f.key));
	let key = base;
	let suffix = 1;
	while (usedKeys.has(key)) {
		suffix += 1;
		key = `${base}${suffix}`;
	}

	const nextSortOrder = existing.reduce((max, f) => Math.max(max, f.sortOrder), -1) + 1;

	await db.transaction(async (tx) => {
		await tx.insert(fieldDefinition).values({
			id: randomUUID(),
			organizationId: params.organizationId,
			objectTypeId: params.objectTypeId,
			key,
			label: params.label,
			dataType: params.dataType,
			required: params.required ?? false,
			selectOptions: params.dataType === 'select' ? params.selectOptions : undefined,
			sortOrder: nextSortOrder
		});
		await logActivity(tx, {
			organizationId: params.organizationId,
			objectTypeId: params.objectTypeId,
			actorUserId: params.actorUserId,
			action: 'field_definition.created',
			summary: `Added field "${params.label}" (${params.dataType})`
		});
	});
}

export async function updateFieldDefinition(
	fieldId: string,
	params: {
		label?: string;
		required?: boolean;
		selectOptions?: { value: string; label: string }[];
	},
	actorUserId: string
) {
	const before = await db.query.fieldDefinition.findFirst({ where: eq(fieldDefinition.id, fieldId) });
	if (!before) return;
	await db.transaction(async (tx) => {
		await tx.update(fieldDefinition).set(params).where(eq(fieldDefinition.id, fieldId));
		await logActivity(tx, {
			organizationId: before.organizationId,
			objectTypeId: before.objectTypeId,
			actorUserId,
			action: 'field_definition.updated',
			summary: `Updated field "${before.label}"`,
			changes: { before: { label: before.label, required: before.required }, after: params }
		});
	});
}

export async function deleteFieldDefinition(fieldId: string, actorUserId: string) {
	const field = await db.query.fieldDefinition.findFirst({ where: eq(fieldDefinition.id, fieldId) });
	if (!field) return;
	if (field.locked) {
		throw new Error(`"${field.label}" is a required field and can't be removed`);
	}
	await db.transaction(async (tx) => {
		await tx.delete(fieldDefinition).where(eq(fieldDefinition.id, fieldId));
		await logActivity(tx, {
			organizationId: field.organizationId,
			objectTypeId: field.objectTypeId,
			actorUserId,
			action: 'field_definition.deleted',
			summary: `Deleted field "${field.label}"`
		});
	});
}

/**
 * Turning filterable/reportable on allocates a slot (and backfills existing records) the
 * first time either flag is enabled; turning both off just frees the slot for reuse —
 * no backfill needed since nothing reads an unmapped slot value.
 */
async function setFieldFlags(fieldId: string, flags: { filterable?: boolean; reportable?: boolean }) {
	const field = await db.query.fieldDefinition.findFirst({ where: eq(fieldDefinition.id, fieldId) });
	if (!field) throw new Error('Field not found');

	const nextFilterable = flags.filterable ?? field.filterable;
	const nextReportable = flags.reportable ?? field.reportable;
	const needsSlot = nextFilterable || nextReportable;

	await db.transaction(async (tx) => {
		let slot = field.storageSlot;
		if (needsSlot && !slot) {
			slot = await allocateSlot(tx, field.objectTypeId, field.dataType);
			await backfillSlot(tx, field.objectTypeId, field.key, slot, slotFamilyFor(field.dataType));
		} else if (!needsSlot && slot) {
			slot = null;
		}
		await tx
			.update(fieldDefinition)
			.set({ filterable: nextFilterable, reportable: nextReportable, storageSlot: slot })
			.where(eq(fieldDefinition.id, fieldId));
	});
}

export async function toggleFilterable(fieldId: string, filterable: boolean) {
	await setFieldFlags(fieldId, { filterable });
}

export async function toggleReportable(fieldId: string, reportable: boolean) {
	await setFieldFlags(fieldId, { reportable });
}

export async function moveFieldDefinition(objectTypeId: string, fieldId: string, direction: 'up' | 'down') {
	const fields = await db.query.fieldDefinition.findMany({
		where: eq(fieldDefinition.objectTypeId, objectTypeId),
		orderBy: (f, { asc }) => asc(f.sortOrder)
	});

	const index = fields.findIndex((f) => f.id === fieldId);
	const swapIndex = direction === 'up' ? index - 1 : index + 1;
	if (index === -1 || swapIndex < 0 || swapIndex >= fields.length) return;

	const a = fields[index];
	const b = fields[swapIndex];

	await db.transaction(async (tx) => {
		await tx.update(fieldDefinition).set({ sortOrder: b.sortOrder }).where(eq(fieldDefinition.id, a.id));
		await tx.update(fieldDefinition).set({ sortOrder: a.sortOrder }).where(eq(fieldDefinition.id, b.id));
	});
}
