import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { objectType, fieldDefinition, record } from '$lib/server/db/schema';
import type { FieldDataType } from './fieldDefinitions';
import type { LookupKind } from '$lib/server/db/lookup.schema';
import { ensureDefaultLookupValues } from './lookupValues';
import { logActivity } from './activityLog';

export const BUILTIN_KINDS = ['asset', 'accessory', 'consumable', 'component', 'custom'] as const;
export type BuiltinKind = (typeof BUILTIN_KINDS)[number];

/** The four kinds every org gets exactly one auto-provisioned singleton of. */
export const SINGLETON_KINDS = ['asset', 'accessory', 'consumable', 'component'] as const;
export type SingletonKind = (typeof SINGLETON_KINDS)[number];

const SINGLETON_NAMES: Record<SingletonKind, string> = {
	asset: 'Assets',
	accessory: 'Accessories',
	consumable: 'Consumables',
	component: 'Components'
};

interface FieldPreset {
	key: string;
	label: string;
	dataType: FieldDataType;
	required?: boolean;
	selectOptions?: { value: string; label: string }[];
	/** Can't be deleted — service-layer logic depends on the key existing. */
	locked?: boolean;
	/** Value is written by checkouts.ts, never submitted from a create/edit form. */
	systemManaged?: boolean;
	/** Only meaningful when dataType === 'reference' — which lookup_value list this points at. */
	referenceKind?: LookupKind;
}

// Every kind — including custom — gets this first. It's how every trackable thing gets a
// human-readable label regardless of what other fields the org configures.
const NAME_FIELD: FieldPreset = { key: 'name', label: 'Name', dataType: 'text', required: true, locked: true };

// Physical-goods lookups, reused across the kinds where they make sense.
const CATEGORY_FIELD: FieldPreset = { key: 'category', label: 'Category', dataType: 'reference', referenceKind: 'category' };
const MANUFACTURER_FIELD: FieldPreset = {
	key: 'manufacturer',
	label: 'Manufacturer',
	dataType: 'reference',
	referenceKind: 'manufacturer'
};
// Physical/functional condition — independent of the real checkout-tracked status below, so it
// doesn't fit consumables (a box of toner isn't "working with a minor fault").
const CONDITION_FIELD: FieldPreset = { key: 'condition', label: 'Condition', dataType: 'reference', referenceKind: 'condition' };

const BUILTIN_FIELD_PRESETS: Record<BuiltinKind, FieldPreset[]> = {
	// Note: no `status`/`assignedTo` field here — both are already tracked for real by
	// `record.status` + the `checkout` table (see checkouts.ts), so a duplicate field-level
	// copy of that state would just drift out of sync. `condition` below is the genuinely
	// independent piece of information a duplicate status field would have obscured.
	asset: [
		NAME_FIELD,
		{ key: 'assetTag', label: 'Asset tag', dataType: 'text', required: true },
		CATEGORY_FIELD,
		MANUFACTURER_FIELD,
		{ key: 'model', label: 'Model', dataType: 'text' },
		{ key: 'serialNumber', label: 'Serial number', dataType: 'text' },
		CONDITION_FIELD,
		{ key: 'purchaseDate', label: 'Purchase date', dataType: 'date' }
	],
	// Quantity-based stock, checked out to a user, returnable (see checkouts.ts KIND_RULES).
	accessory: [
		NAME_FIELD,
		{ key: 'quantity', label: 'Quantity', dataType: 'number', required: true, locked: true },
		CATEGORY_FIELD,
		MANUFACTURER_FIELD,
		CONDITION_FIELD
	],
	// Quantity-based stock, issued to a user, consumed (no check-in).
	consumable: [
		NAME_FIELD,
		{ key: 'quantity', label: 'Quantity', dataType: 'number', required: true, locked: true },
		{
			key: 'remainingQuantity',
			label: 'Remaining',
			dataType: 'number',
			locked: true,
			systemManaged: true
		},
		{ key: 'minQuantity', label: 'Minimum quantity', dataType: 'number', required: true, locked: true },
		CATEGORY_FIELD,
		MANUFACTURER_FIELD
	],
	// Quantity-based stock, installed into an asset, returnable.
	component: [
		NAME_FIELD,
		{ key: 'quantity', label: 'Quantity', dataType: 'number', required: true, locked: true },
		CATEGORY_FIELD,
		MANUFACTURER_FIELD,
		CONDITION_FIELD
	],
	custom: [NAME_FIELD]
};

// Sibling static routes under /o/[orgSlug]/ — an object type can't take one of these slugs
// or its records list would be permanently shadowed by the static route.
const RESERVED_SLUGS = new Set(['object-types', 'checkouts', 'reports', 'manage', 'scan']);

function slugify(value: string): string {
	const base =
		value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '') || 'object-type';
	return RESERVED_SLUGS.has(base) ? `${base}-type` : base;
}

export async function createObjectType(params: {
	organizationId: string;
	name: string;
	description?: string;
	builtinKind: BuiltinKind;
	createdBy: string;
	/** Only meaningful for builtinKind 'custom' — see the column's own comment in object.schema.ts. */
	trackingMode?: 'individual' | 'bulk';
	/** Only meaningful for builtinKind 'custom' with trackingMode 'individual'. */
	allowComponentInstall?: boolean;
}): Promise<string> {
	const id = randomUUID();

	await db.transaction(async (tx) => {
		const base = slugify(params.name);
		let slug = base;
		let suffix = 1;
		while (
			await tx.query.objectType.findFirst({
				where: and(eq(objectType.organizationId, params.organizationId), eq(objectType.slug, slug))
			})
		) {
			suffix += 1;
			slug = `${base}-${suffix}`;
		}

		await tx.insert(objectType).values({
			id,
			organizationId: params.organizationId,
			name: params.name,
			slug,
			description: params.description,
			builtinKind: params.builtinKind,
			trackingMode: params.builtinKind === 'custom' ? (params.trackingMode ?? 'individual') : 'individual',
			allowComponentInstall:
				params.builtinKind === 'custom' && params.trackingMode !== 'bulk' ? (params.allowComponentInstall ?? false) : false,
			createdBy: params.createdBy
		});

		const presets = BUILTIN_FIELD_PRESETS[params.builtinKind];
		for (const [index, preset] of presets.entries()) {
			await tx.insert(fieldDefinition).values({
				id: randomUUID(),
				organizationId: params.organizationId,
				objectTypeId: id,
				key: preset.key,
				label: preset.label,
				dataType: preset.dataType,
				required: preset.required ?? false,
				selectOptions: preset.selectOptions,
				referenceKind: preset.referenceKind,
				sortOrder: index,
				isBuiltin: true,
				locked: preset.locked ?? false,
				systemManaged: preset.systemManaged ?? false
			});
		}

		await logActivity(tx, {
			organizationId: params.organizationId,
			objectTypeId: id,
			actorUserId: params.createdBy,
			action: 'object_type.created',
			summary: `Created object type "${params.name}"${params.builtinKind === 'custom' ? '' : ' (built-in)'}`
		});
	});

	return id;
}

/**
 * Backfills any preset fields (by key) missing from an existing built-in object type, updates any
 * `isBuiltin` field whose shape (dataType/referenceKind/etc.) has drifted from the current preset
 * (e.g. `manufacturer` moving from free text to a `reference` lookup), and prunes `isBuiltin`
 * fields whose key is no longer in the current preset at all (e.g. the deprecated `status`/
 * `assignedTo` on assets). Never touches fields an admin added themselves — only ever `isBuiltin`
 * rows are touched — so a dataType change or removal just orphans the underlying record JSON
 * values, same as an unmapped slot.
 */
async function ensureBuiltinFields(objectTypeId: string, organizationId: string, kind: BuiltinKind): Promise<void> {
	const existing = await db.query.fieldDefinition.findMany({ where: eq(fieldDefinition.objectTypeId, objectTypeId) });
	const existingByKey = new Map(existing.map((f) => [f.key, f]));
	const presetKeys = new Set(BUILTIN_FIELD_PRESETS[kind].map((p) => p.key));
	let nextSortOrder = existing.reduce((max, f) => Math.max(max, f.sortOrder), -1) + 1;

	for (const preset of BUILTIN_FIELD_PRESETS[kind]) {
		const current = existingByKey.get(preset.key);
		if (!current) {
			await db.insert(fieldDefinition).values({
				id: randomUUID(),
				organizationId,
				objectTypeId,
				key: preset.key,
				label: preset.label,
				dataType: preset.dataType,
				required: preset.required ?? false,
				selectOptions: preset.selectOptions,
				referenceKind: preset.referenceKind,
				sortOrder: nextSortOrder++,
				isBuiltin: true,
				locked: preset.locked ?? false,
				systemManaged: preset.systemManaged ?? false
			});
			continue;
		}

		if (current.isBuiltin && (current.dataType !== preset.dataType || current.referenceKind !== (preset.referenceKind ?? null))) {
			await db
				.update(fieldDefinition)
				.set({
					label: preset.label,
					dataType: preset.dataType,
					referenceKind: preset.referenceKind ?? null,
					required: preset.required ?? false,
					selectOptions: preset.selectOptions ?? null,
					locked: preset.locked ?? false,
					systemManaged: preset.systemManaged ?? false
				})
				.where(eq(fieldDefinition.id, current.id));
		}
	}

	for (const field of existing) {
		if (field.isBuiltin && !presetKeys.has(field.key)) {
			await db.delete(fieldDefinition).where(eq(fieldDefinition.id, field.id));
		}
	}
}

/**
 * Idempotent — creates whichever of the four singleton kinds this org doesn't already have,
 * backfills/prunes preset fields on existing ones, and seeds default lookup values.
 */
export async function ensureBuiltinObjectTypes(organizationId: string, createdBy: string): Promise<void> {
	for (const kind of SINGLETON_KINDS) {
		const existing = await getSingletonObjectType(organizationId, kind);
		if (existing) {
			await ensureBuiltinFields(existing.id, organizationId, kind);
			continue;
		}
		await createObjectType({ organizationId, name: SINGLETON_NAMES[kind], builtinKind: kind, createdBy });
	}
	await ensureDefaultLookupValues(organizationId);
}

export async function getSingletonObjectType(organizationId: string, kind: SingletonKind) {
	return db.query.objectType.findFirst({
		where: and(
			eq(objectType.organizationId, organizationId),
			eq(objectType.builtinKind, kind),
			eq(objectType.isArchived, false)
		),
		// Deterministic if duplicates ever exist (e.g. pre-migration data) — oldest wins.
		orderBy: (t, { asc }) => asc(t.createdAt)
	});
}

export async function listObjectTypes(organizationId: string, opts?: { kind?: BuiltinKind }) {
	const conditions = [eq(objectType.organizationId, organizationId), eq(objectType.isArchived, false)];
	if (opts?.kind) conditions.push(eq(objectType.builtinKind, opts.kind));

	return db.query.objectType.findMany({
		where: and(...conditions),
		with: { fields: true },
		orderBy: (t, { asc }) => asc(t.name)
	});
}

export async function getObjectType(organizationId: string, objectTypeId: string) {
	return db.query.objectType.findFirst({
		where: and(eq(objectType.organizationId, organizationId), eq(objectType.id, objectTypeId)),
		with: { fields: { orderBy: (f, { asc }) => asc(f.sortOrder) } }
	});
}

/** Active object types with a live count of their (non-deleted) records, for the dashboard. */
export async function getObjectTypeSummaries(organizationId: string) {
	const [types, counts] = await Promise.all([
		listObjectTypes(organizationId),
		db
			.select({ objectTypeId: record.objectTypeId, count: sql<number>`count(*)` })
			.from(record)
			.where(and(eq(record.organizationId, organizationId), isNull(record.deletedAt)))
			.groupBy(record.objectTypeId)
	]);

	const countByType = new Map(counts.map((c) => [c.objectTypeId, Number(c.count)]));
	return types.map((t) => ({ ...t, recordCount: countByType.get(t.id) ?? 0 }));
}

export async function getObjectTypeBySlug(organizationId: string, slug: string) {
	return db.query.objectType.findFirst({
		where: and(eq(objectType.organizationId, organizationId), eq(objectType.slug, slug)),
		with: { fields: { orderBy: (f, { asc }) => asc(f.sortOrder) } }
	});
}

export async function updateObjectType(
	organizationId: string,
	objectTypeId: string,
	params: {
		name?: string;
		description?: string | null;
		barcodeFieldKeys?: string[] | null;
		requestable?: boolean;
		quantityFieldKey?: string | null;
		allowComponentInstall?: boolean;
	},
	actorUserId: string
) {
	const before = await db.query.objectType.findFirst({
		where: and(eq(objectType.organizationId, organizationId), eq(objectType.id, objectTypeId))
	});
	await db.transaction(async (tx) => {
		await tx
			.update(objectType)
			.set(params)
			.where(and(eq(objectType.organizationId, organizationId), eq(objectType.id, objectTypeId)));
		await logActivity(tx, {
			organizationId,
			objectTypeId,
			actorUserId,
			action: 'object_type.updated',
			summary: `Updated object type "${before?.name ?? objectTypeId}" settings`,
			changes: { before, after: params }
		});
	});
}

export async function setObjectTypeArchived(
	organizationId: string,
	objectTypeId: string,
	archived: boolean,
	actorUserId: string
) {
	const existing = await db.query.objectType.findFirst({
		where: and(eq(objectType.organizationId, organizationId), eq(objectType.id, objectTypeId))
	});
	if (!existing) return;
	if (existing.builtinKind !== 'custom') {
		throw new Error('Assets, Accessories, Consumables, and Components are permanent and cannot be archived');
	}

	await db.transaction(async (tx) => {
		await tx
			.update(objectType)
			.set({ isArchived: archived })
			.where(and(eq(objectType.organizationId, organizationId), eq(objectType.id, objectTypeId)));
		await logActivity(tx, {
			organizationId,
			objectTypeId,
			actorUserId,
			action: archived ? 'object_type.archived' : 'object_type.unarchived',
			summary: `${archived ? 'Archived' : 'Unarchived'} object type "${existing.name}"`
		});
	});
}
