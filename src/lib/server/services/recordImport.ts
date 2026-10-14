import { fieldDefinition } from '$lib/server/db/schema';
import { getObjectType } from './objectTypes';
import { createRecord, fieldValueExists } from './records';
import { recalculateRemainingQuantity } from './checkouts';
import { listOrgUsers } from './members';
import { createLookupValue, listAllLookupValues, type LookupKind } from './lookupValues';

export const MAX_IMPORT_ROWS = 2000;

export interface ImportRowResult {
	row: number;
	success: boolean;
	message?: string;
}

type FieldRow = typeof fieldDefinition.$inferSelect;

/**
 * Resolves one CSV cell to a storable value for the given field, matching select/reference/
 * user_reference against existing options by label/name rather than requiring the raw stored
 * value/id — a CSV is written by a human, not by this app.
 */
async function resolveCellValue(
	field: FieldRow,
	raw: string,
	ctx: {
		organizationId: string;
		orgUsers: { id: string; name: string; email?: string }[];
		lookupByKind: Record<LookupKind, { id: string; name: string }[]>;
		createdBy: string;
	}
): Promise<{ value?: unknown; error?: string }> {
	switch (field.dataType) {
		case 'number': {
			const n = Number(raw);
			if (!Number.isFinite(n)) return { error: `"${raw}" is not a valid number for ${field.label}` };
			return { value: n };
		}
		case 'boolean':
			return { value: ['true', 'yes', 'y', '1'].includes(raw.toLowerCase()) };
		case 'select': {
			const match = field.selectOptions?.find(
				(o) => o.value === raw || o.label.toLowerCase() === raw.toLowerCase()
			);
			if (!match) return { error: `"${raw}" is not a valid option for ${field.label}` };
			return { value: match.value };
		}
		case 'user_reference': {
			const match = ctx.orgUsers.find(
				(u) => u.name.toLowerCase() === raw.toLowerCase() || u.email?.toLowerCase() === raw.toLowerCase()
			);
			if (!match) return { error: `No user matching "${raw}" for ${field.label}` };
			return { value: match.id };
		}
		case 'reference': {
			const kind = field.referenceKind as LookupKind;
			const list = ctx.lookupByKind[kind];
			const match = list.find((v) => v.name.toLowerCase() === raw.toLowerCase());
			if (match) return { value: match.id };
			// A CSV naming a manufacturer/category/condition that doesn't exist yet is normal
			// (importing real-world data) — create it rather than failing the whole row.
			const created = await createLookupValue(ctx.organizationId, kind, raw, false, ctx.createdBy);
			list.push(created);
			return { value: created.id };
		}
		default:
			return { value: raw };
	}
}

export async function importRecords(params: {
	organizationId: string;
	objectTypeId: string;
	rows: Record<string, string>[];
	mapping: Record<string, string>;
	createdBy: string;
}): Promise<{ results: ImportRowResult[]; created: number; failed: number }> {
	const objectType = await getObjectType(params.organizationId, params.objectTypeId);
	if (!objectType) throw new Error('Object type not found');

	const editableFields = objectType.fields.filter((f) => !f.systemManaged);
	// mapping is csvHeader -> fieldKey; invert for fast per-field lookup while walking each row.
	const headerByFieldKey = new Map(Object.entries(params.mapping).map(([header, key]) => [key, header]));

	const [orgUsers, lookupValues] = await Promise.all([
		listOrgUsers(params.organizationId),
		listAllLookupValues(params.organizationId)
	]);
	const lookupByKind = lookupValues as unknown as Record<LookupKind, { id: string; name: string }[]>;

	const isAsset = objectType.builtinKind === 'asset';
	const seenInBatch: Record<string, Set<string>> = { assetTag: new Set(), serialNumber: new Set() };

	const results: ImportRowResult[] = [];

	for (let i = 0; i < params.rows.length; i++) {
		const row = params.rows[i];
		const rowNumber = i + 1;
		const values: Record<string, unknown> = {};
		const missingRequired: string[] = [];
		let rowError: string | undefined;

		for (const field of editableFields) {
			const header = headerByFieldKey.get(field.key);
			const raw = header ? row[header]?.trim() : undefined;

			if (!raw) {
				if (field.required) missingRequired.push(field.label);
				continue;
			}

			const resolved = await resolveCellValue(field, raw, {
				organizationId: params.organizationId,
				orgUsers,
				lookupByKind,
				createdBy: params.createdBy
			});
			if (resolved.error) {
				rowError = resolved.error;
				break;
			}
			values[field.key] = resolved.value;
		}

		if (!rowError && missingRequired.length > 0) {
			rowError = `${missingRequired.join(', ')} ${missingRequired.length === 1 ? 'is' : 'are'} required`;
		}

		if (!rowError && objectType.builtinKind === 'consumable' && Number(values.minQuantity) < 1) {
			rowError = 'Minimum quantity must be at least 1';
		}

		if (!rowError && isAsset) {
			for (const key of ['assetTag', 'serialNumber'] as const) {
				const raw = values[key];
				if (typeof raw !== 'string' || !raw.trim()) continue;
				const normalized = raw.trim().toLowerCase();
				if (seenInBatch[key].has(normalized)) {
					const label = editableFields.find((f) => f.key === key)?.label ?? key;
					rowError = `Another row in this file already has that ${label.toLowerCase()}`;
					break;
				}
				if (await fieldValueExists(params.organizationId, params.objectTypeId, key, raw.trim())) {
					const label = editableFields.find((f) => f.key === key)?.label ?? key;
					rowError = `Another asset with that ${label.toLowerCase()} already exists`;
					break;
				}
			}
		}

		if (rowError) {
			results.push({ row: rowNumber, success: false, message: rowError });
			continue;
		}

		if (isAsset) {
			for (const key of ['assetTag', 'serialNumber'] as const) {
				const raw = values[key];
				if (typeof raw === 'string' && raw.trim()) seenInBatch[key].add(raw.trim().toLowerCase());
			}
		}

		const recordId = await createRecord({
			organizationId: params.organizationId,
			objectTypeId: params.objectTypeId,
			values,
			createdBy: params.createdBy
		});
		if (objectType.builtinKind === 'consumable') {
			await recalculateRemainingQuantity(params.organizationId, recordId);
		}

		results.push({ row: rowNumber, success: true });
	}

	return {
		results,
		created: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length
	};
}
