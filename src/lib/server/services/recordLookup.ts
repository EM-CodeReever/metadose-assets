import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { record } from '$lib/server/db/schema';
import { listObjectTypes } from './objectTypes';

export interface LookupMatch {
	recordId: string;
	recordName: string;
	objectTypeSlug: string;
	objectTypeName: string;
	matchedField: string;
}

/**
 * Looks up a scanned value as a record's own id — the default thing every printed barcode now
 * encodes (see the label print page), since an id is always present and always unique, unlike a
 * configured field. Checked first by the scan page, before falling back to field-value matching
 * for anything typed manually or scanned from an older label.
 */
export async function findRecordById(organizationId: string, value: string): Promise<LookupMatch | null> {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const found = await db.query.record.findFirst({
		where: and(eq(record.organizationId, organizationId), eq(record.id, trimmed), isNull(record.deletedAt)),
		with: { objectType: true }
	});
	if (!found) return null;

	return {
		recordId: found.id,
		recordName: String(found.data.values.name ?? found.id),
		objectTypeSlug: found.objectType.slug,
		objectTypeName: found.objectType.name,
		matchedField: 'ID'
	};
}

/**
 * Finds records whose configured barcode/QR label field(s) exactly match a scanned value —
 * the counterpart to the label-printing feature, used by the scan-to-lookup page. Only checks
 * object types that have `barcodeFieldKeys` configured, since those are the only fields a
 * printed label could have encoded in the first place.
 */
export async function findRecordsByLabelValue(organizationId: string, value: string): Promise<LookupMatch[]> {
	const trimmed = value.trim();
	if (!trimmed) return [];

	const objectTypes = await listObjectTypes(organizationId);
	const matches: LookupMatch[] = [];
	const seenRecordIds = new Set<string>();

	for (const ot of objectTypes) {
		const keys = ot.barcodeFieldKeys ?? [];
		if (keys.length === 0) continue;

		for (const key of keys) {
			const field = ot.fields.find((f) => f.key === key);
			if (!field) continue;

			const found = await db.query.record.findMany({
				where: and(
					eq(record.organizationId, organizationId),
					eq(record.objectTypeId, ot.id),
					isNull(record.deletedAt),
					sql`lower(json_unquote(json_extract(${record.data}, ${'$.values.' + key}))) = lower(${trimmed})`
				)
			});

			for (const r of found) {
				if (seenRecordIds.has(r.id)) continue;
				seenRecordIds.add(r.id);
				matches.push({
					recordId: r.id,
					recordName: String(r.data.values.name ?? r.id),
					objectTypeSlug: ot.slug,
					objectTypeName: ot.name,
					matchedField: field.label
				});
			}
		}
	}

	return matches;
}
