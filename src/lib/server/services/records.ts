import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { record, fieldDefinition, SLOT_COLUMNS, checkout } from '$lib/server/db/schema';
import type { FieldDataType } from './fieldDefinitions';
import { logActivity } from './activityLog';
import { getStorage } from '$lib/server/storage';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function toSlotValue(dataType: FieldDataType, value: unknown): unknown {
	if (value === undefined || value === null || value === '') return null;
	switch (dataType) {
		case 'boolean':
			return value ? 1 : 0;
		case 'number': {
			const n = Number(value);
			return Number.isFinite(n) ? n : null;
		}
		case 'date':
			// Strip a trailing 'Z' (UTC designator) — MySQL's CAST(... AS DATETIME) rejects it.
			return typeof value === 'string' ? value.replace(/Z$/, '') : value;
		default:
			return value;
	}
}

/** Builds data.slots from data.values for whichever fields currently have a storageSlot assigned. */
export async function buildSlotsJson(
	objectTypeId: string,
	values: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const fields = await db.query.fieldDefinition.findMany({
		where: eq(fieldDefinition.objectTypeId, objectTypeId)
	});

	const slots: Record<string, unknown> = {};
	for (const f of fields) {
		if (!f.storageSlot) continue;
		const v = toSlotValue(f.dataType, values[f.key]);
		if (v !== null) slots[f.storageSlot] = v;
	}
	return slots;
}

export async function createRecord(params: {
	organizationId: string;
	objectTypeId: string;
	values: Record<string, unknown>;
	createdBy: string;
	defaultLocationId?: string;
}): Promise<string> {
	const id = randomUUID();
	const slots = await buildSlotsJson(params.objectTypeId, params.values);

	await db.transaction(async (tx) => {
		await tx.insert(record).values({
			id,
			organizationId: params.organizationId,
			objectTypeId: params.objectTypeId,
			data: { values: params.values, slots },
			createdBy: params.createdBy,
			updatedBy: params.createdBy,
			defaultLocationId: params.defaultLocationId
		});
		await logActivity(tx, {
			organizationId: params.organizationId,
			recordId: id,
			objectTypeId: params.objectTypeId,
			actorUserId: params.createdBy,
			action: 'record.created',
			changes: { after: params.values }
		});
	});

	return id;
}

export async function updateRecord(params: {
	organizationId: string;
	objectTypeId: string;
	recordId: string;
	values: Record<string, unknown>;
	updatedBy: string;
}) {
	const before = await getRecord(params.organizationId, params.recordId);
	const slots = await buildSlotsJson(params.objectTypeId, params.values);

	await db.transaction(async (tx) => {
		await tx
			.update(record)
			.set({ data: { values: params.values, slots }, updatedBy: params.updatedBy })
			.where(and(eq(record.id, params.recordId), eq(record.organizationId, params.organizationId)));
		await logActivity(tx, {
			organizationId: params.organizationId,
			recordId: params.recordId,
			objectTypeId: params.objectTypeId,
			actorUserId: params.updatedBy,
			action: 'record.updated',
			changes: { before: before?.data.values, after: params.values }
		});
	});
}

/** True if another (non-deleted) record of this object type already has this exact field value. */
export async function fieldValueExists(
	organizationId: string,
	objectTypeId: string,
	fieldKey: string,
	value: string,
	excludeRecordId?: string
): Promise<boolean> {
	const conditions = [
		eq(record.organizationId, organizationId),
		eq(record.objectTypeId, objectTypeId),
		isNull(record.deletedAt),
		sql`lower(json_unquote(json_extract(${record.data}, ${'$.values.' + fieldKey}))) = lower(${value})`
	];
	if (excludeRecordId) conditions.push(ne(record.id, excludeRecordId));

	const existing = await db.query.record.findFirst({ where: and(...conditions) });
	return !!existing;
}

export async function getRecord(organizationId: string, recordId: string) {
	return db.query.record.findFirst({
		where: and(eq(record.organizationId, organizationId), eq(record.id, recordId), isNull(record.deletedAt))
	});
}

/**
 * Per-record exception to its object type's own `requestable` default — `null` clears the
 * override and goes back to following the type setting; `true`/`false` forces it either way for
 * just this one record (e.g. most assets are requestable, but this specific laptop is reserved).
 */
export async function setRecordRequestableOverride(
	organizationId: string,
	recordId: string,
	override: boolean | null,
	actorUserId: string
): Promise<void> {
	await db
		.update(record)
		.set({ requestableOverride: override, updatedBy: actorUserId })
		.where(and(eq(record.id, recordId), eq(record.organizationId, organizationId)));
}

/** Retires a record from active circulation without deleting it — distinct from soft-delete. */
export async function archiveRecord(organizationId: string, recordId: string, actorUserId: string): Promise<void> {
	const openCheckout = await db.query.checkout.findFirst({
		where: and(eq(checkout.organizationId, organizationId), eq(checkout.recordId, recordId), isNull(checkout.checkedInAt))
	});
	if (openCheckout) throw new Error('Check this in before archiving it');

	await db.transaction(async (tx) => {
		await tx
			.update(record)
			.set({ status: 'archived', updatedBy: actorUserId })
			.where(and(eq(record.id, recordId), eq(record.organizationId, organizationId)));
		await logActivity(tx, { organizationId, recordId, actorUserId, action: 'record.archived' });
	});
}

export async function unarchiveRecord(organizationId: string, recordId: string, actorUserId: string): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.update(record)
			.set({ status: 'available', updatedBy: actorUserId })
			.where(and(eq(record.id, recordId), eq(record.organizationId, organizationId)));
		await logActivity(tx, { organizationId, recordId, actorUserId, action: 'record.unarchived' });
	});
}

/**
 * Sets (or replaces) a record's single cover image — distinct from the general attachments
 * list, so it has its own storage columns rather than being just another attachment row.
 */
export async function setRecordImage(params: {
	organizationId: string;
	recordId: string;
	file: File;
	actorUserId: string;
}): Promise<void> {
	if (!ALLOWED_IMAGE_MIME_TYPES.has(params.file.type)) {
		throw new Error('Unsupported image type — use PNG, JPEG, WebP, or GIF');
	}
	if (params.file.size === 0) throw new Error('Image is empty');
	if (params.file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large (max 8MB)');

	const existing = await getRecord(params.organizationId, params.recordId);
	if (!existing) throw new Error('Record not found');

	const key = `${params.organizationId}/${params.recordId}/image-${randomUUID()}`;
	const buffer = Buffer.from(await params.file.arrayBuffer());
	await getStorage().put(key, buffer);

	await db
		.update(record)
		.set({
			imageStorageKey: key,
			imageMimeType: params.file.type,
			imageFileName: params.file.name,
			imageSizeBytes: params.file.size,
			updatedBy: params.actorUserId
		})
		.where(and(eq(record.id, params.recordId), eq(record.organizationId, params.organizationId)));

	// Clean up the old file only after the new one is safely written and referenced.
	if (existing.imageStorageKey) {
		await getStorage()
			.delete(existing.imageStorageKey)
			.catch(() => {});
	}
}

export async function removeRecordImage(organizationId: string, recordId: string, actorUserId: string): Promise<void> {
	const existing = await getRecord(organizationId, recordId);
	if (!existing?.imageStorageKey) return;

	await db
		.update(record)
		.set({ imageStorageKey: null, imageMimeType: null, imageFileName: null, imageSizeBytes: null, updatedBy: actorUserId })
		.where(and(eq(record.id, recordId), eq(record.organizationId, organizationId)));

	await getStorage()
		.delete(existing.imageStorageKey)
		.catch(() => {});
}

export async function softDeleteRecord(organizationId: string, recordId: string, actorUserId: string) {
	await db.transaction(async (tx) => {
		await tx
			.update(record)
			.set({ deletedAt: new Date() })
			.where(and(eq(record.organizationId, organizationId), eq(record.id, recordId)));
		await logActivity(tx, {
			organizationId,
			recordId,
			actorUserId,
			action: 'record.deleted'
		});
	});
}

interface FieldLike {
	key: string;
	label: string;
	dataType: FieldDataType;
	required: boolean;
}

/** Maps submitted form fields to a record's `values` object, typed per field's dataType. */
export function parseRecordFormValues(
	fields: FieldLike[],
	formData: FormData
): { values: Record<string, unknown>; missingRequired: string[] } {
	const values: Record<string, unknown> = {};
	const missingRequired: string[] = [];

	for (const f of fields) {
		if (f.dataType === 'boolean') {
			values[f.key] = formData.get(f.key) === 'on';
			continue;
		}

		const raw = formData.get(f.key)?.toString().trim();
		if (!raw) {
			if (f.required) missingRequired.push(f.label);
			continue;
		}

		values[f.key] = f.dataType === 'number' ? Number(raw) : raw;
	}

	return { values, missingRequired };
}

export interface ListRecordsParams {
	organizationId: string;
	objectTypeId: string;
	search?: string;
	filterKey?: string;
	filterValue?: string;
	status?: string;
	sortKey?: string;
	sortDirection?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

/**
 * Filters/sorts by a slot column when the field has one assigned (fast, indexed path);
 * otherwise falls back to an unindexed JSON_EXTRACT (correct but slower) — the
 * incentive for admins to flag genuinely useful report/filter columns.
 */
export async function listRecords(params: ListRecordsParams) {
	const fields = await db.query.fieldDefinition.findMany({
		where: eq(fieldDefinition.objectTypeId, params.objectTypeId)
	});
	const fieldByKey = new Map(fields.map((f) => [f.key, f]));

	const conditions = [
		eq(record.organizationId, params.organizationId),
		eq(record.objectTypeId, params.objectTypeId),
		isNull(record.deletedAt)
	];

	if (params.search) {
		conditions.push(sql`cast(${record.data} as char) like ${'%' + params.search + '%'}`);
	}

	if (params.status) {
		conditions.push(eq(record.status, params.status));
	}

	if (params.filterKey && params.filterValue) {
		const field = fieldByKey.get(params.filterKey);
		if (field) {
			if (field.storageSlot) {
				const column = SLOT_COLUMNS[field.storageSlot as keyof typeof SLOT_COLUMNS];
				conditions.push(eq(column, params.filterValue));
			} else {
				conditions.push(
					sql`json_unquote(json_extract(${record.data}, ${'$.values.' + field.key})) = ${params.filterValue}`
				);
			}
		}
	}

	const dir = params.sortDirection === 'asc' ? asc : desc;
	let orderByExpr: SQL | ReturnType<typeof asc> = desc(record.createdAt);
	if (params.sortKey) {
		// A field with this key always wins over the built-in record columns below —
		// otherwise a field literally named "status" (as our IT-asset preset has) would
		// be silently shadowed by the record's own lifecycle status column.
		const field = fieldByKey.get(params.sortKey);
		if (!field && params.sortKey === 'createdAt') {
			orderByExpr = dir(record.createdAt);
		} else if (!field && params.sortKey === 'status') {
			orderByExpr = dir(record.status);
		} else if (field?.storageSlot) {
			orderByExpr = dir(SLOT_COLUMNS[field.storageSlot as keyof typeof SLOT_COLUMNS]);
		} else if (field) {
			orderByExpr = dir(sql`json_extract(${record.data}, ${'$.values.' + field.key})`);
		}
	}

	const page = Math.max(params.page ?? 1, 1);
	const pageSize = params.pageSize ?? 25;
	const where = and(...conditions);

	const [rows, [{ count }]] = await Promise.all([
		db
			.select()
			.from(record)
			.where(where)
			.orderBy(orderByExpr)
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db.select({ count: sql<number>`count(*)` }).from(record).where(where)
	]);

	return { rows, total: Number(count), page, pageSize, fields };
}
