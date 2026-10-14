import { error } from '@sveltejs/kit';
import { resolveOrgMembership } from '$lib/server/authz';
import { getObjectTypeBySlug } from '$lib/server/services/objectTypes';
import { listRecords } from '$lib/server/services/records';
import { listOrgUsers } from '$lib/server/services/members';
import { getCurrentCheckoutsByRecordId } from '$lib/server/services/checkouts';
import { listAllLookupValues } from '$lib/server/services/lookupValues';
import { listLocations } from '$lib/server/services/locations';
import type { RequestHandler } from './$types';

function escapeCsvField(value: string): string {
	if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

// Read-only export, gated by org membership only (same as viewing the list itself) — no stricter
// permission, since anyone who can browse these records can already see everything exported here.
export const GET: RequestHandler = async (event) => {
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
	const objectType = await getObjectTypeBySlug(orgMembership.organization.id, event.params.objectTypeSlug);
	if (!objectType) throw error(404, 'Object type not found');

	const url = event.url;
	const search = url.searchParams.get('q') ?? '';
	const filterKey = url.searchParams.get('filterKey') ?? '';
	const filterValue = url.searchParams.get('filterValue') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const sortKey = url.searchParams.get('sort') ?? '';
	const sortDirection = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const requestedColumns = url.searchParams.getAll('cols');

	const [result, orgUsers, lookupValues, locations] = await Promise.all([
		listRecords({
			organizationId: orgMembership.organization.id,
			objectTypeId: objectType.id,
			search: search || undefined,
			filterKey: filterKey || undefined,
			filterValue: filterValue || undefined,
			status: status || undefined,
			sortKey: sortKey || undefined,
			sortDirection,
			page: 1,
			pageSize: 5000
		}),
		listOrgUsers(orgMembership.organization.id),
		listAllLookupValues(orgMembership.organization.id),
		listLocations(orgMembership.organization.id)
	]);

	const checkoutsByRecordId =
		objectType.builtinKind === 'asset'
			? await getCurrentCheckoutsByRecordId(
					orgMembership.organization.id,
					result.rows.map((r) => r.id)
				)
			: new Map();

	const orgUserNames = new Map(orgUsers.map((u) => [u.id, u.name]));
	const lookupNames = new Map(Object.values(lookupValues).flat().map((v) => [v.id, v.name]));
	const locationNames = new Map(locations.map((l) => [l.id, l.name]));
	const fieldsByKey = new Map(objectType.fields.map((f) => [f.key, f]));

	const defaultColumns = [
		...objectType.fields.map((f) => f.key),
		'status',
		...(objectType.builtinKind === 'asset' ? ['location'] : [])
	];
	const columnKeys = requestedColumns.length > 0 ? requestedColumns : defaultColumns;

	function labelFor(key: string): string {
		if (key === 'status') return 'Status';
		if (key === 'location') return 'Location';
		return fieldsByKey.get(key)?.label ?? key;
	}

	function displayValue(key: string, row: (typeof result.rows)[number]): string {
		if (key === 'status') return row.status.replace('_', ' ');
		if (key === 'location') {
			const checkoutLocation = checkoutsByRecordId.get(row.id)?.assignedToLocation?.name;
			if (checkoutLocation) return checkoutLocation;
			return (row.defaultLocationId && locationNames.get(row.defaultLocationId)) || '';
		}

		const field = fieldsByKey.get(key);
		const value = row.data.values[key];
		if (!field || value === undefined || value === null || value === '') return '';
		if (field.dataType === 'boolean') return value ? 'Yes' : 'No';
		if (field.dataType === 'select') return field.selectOptions?.find((o) => o.value === value)?.label ?? String(value);
		if (field.dataType === 'user_reference') return orgUserNames.get(String(value)) ?? String(value);
		if (field.dataType === 'reference') return lookupNames.get(String(value)) ?? String(value);
		return String(value);
	}

	const lines = [
		columnKeys.map(labelFor),
		...result.rows.map((row) => columnKeys.map((key) => displayValue(key, row)))
	];
	const csv = lines.map((line) => line.map(escapeCsvField).join(',')).join('\r\n');

	const fileName = `${objectType.name.replace(/[^a-zA-Z0-9-_]+/g, '_')}.csv`;

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${fileName}"`
		}
	});
};
