import { error, fail } from '@sveltejs/kit';
import { getObjectTypeBySlug } from '$lib/server/services/objectTypes';
import { listRecords } from '$lib/server/services/records';
import { listOrgUsers } from '$lib/server/services/members';
import { addConsumableStock, getCurrentCheckoutsByRecordId, rulesFor } from '$lib/server/services/checkouts';
import { createCheckoutRequest, listMyCheckoutRequests } from '$lib/server/services/checkoutRequests';
import { listAllLookupValues } from '$lib/server/services/lookupValues';
import { listLocations } from '$lib/server/services/locations';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization, membership, user } = await event.parent();
	const objectType = await getObjectTypeBySlug(organization.id, event.params.objectTypeSlug);
	if (!objectType) throw error(404, 'Object type not found');

	const url = event.url;
	const search = url.searchParams.get('q') ?? '';
	const filterKey = url.searchParams.get('filterKey') ?? '';
	const filterValue = url.searchParams.get('filterValue') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const sortKey = url.searchParams.get('sort') ?? '';
	const sortDirection = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);

	const [result, orgUsers, lookupValues, locations] = await Promise.all([
		listRecords({
			organizationId: organization.id,
			objectTypeId: objectType.id,
			search: search || undefined,
			filterKey: filterKey || undefined,
			filterValue: filterValue || undefined,
			status: status || undefined,
			sortKey: sortKey || undefined,
			sortDirection,
			page
		}),
		listOrgUsers(organization.id),
		listAllLookupValues(organization.id),
		listLocations(organization.id)
	]);

	const rules = rulesFor(objectType);

	// Location isn't a field — it's derived from each asset-like record's current open checkout —
	// so it's fetched separately and merged in on the page rather than living in listRecords'
	// generic query. 'user_or_location' covers both real assets and individually-tracked custom
	// types, which share the same "at most one open checkout" shape.
	const checkoutsByRecordId =
		rules.targetType === 'user_or_location'
			? await getCurrentCheckoutsByRecordId(
					organization.id,
					result.rows.map((r) => r.id)
				)
			: new Map();

	// Only members request things — skip this query entirely for every other role.
	const myPendingRequestRecordIds =
		membership?.role === 'member'
			? new Set(
					(await listMyCheckoutRequests(organization.id, user.id))
						.filter((r) => r.status === 'pending')
						.map((r) => r.recordId)
				)
			: new Set<string>();

	return {
		organization,
		membership,
		objectType,
		rules,
		orgUsers,
		lookupValues,
		locations,
		...result,
		checkoutsByRecordId,
		myPendingRequestRecordIds,
		search,
		filterKey,
		filterValue,
		status,
		sortKey,
		sortDirection
	};
};

export const actions: Actions = {
	addStock: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['update'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const recordId = formData.get('recordId')?.toString();
		const amount = Number(formData.get('amount'));
		if (!recordId) return fail(400, { message: 'Missing record' });

		try {
			await addConsumableStock(orgMembership.organization.id, recordId, amount, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not add stock' });
		}

		return { success: true };
	},

	request: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { checkoutRequest: ['create'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const recordId = formData.get('recordId')?.toString();
		const note = formData.get('note')?.toString().trim() || undefined;
		if (!recordId) return fail(400, { message: 'Missing record' });

		try {
			await createCheckoutRequest(orgMembership.organization.id, recordId, user.id, note);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not submit request' });
		}

		return { success: true, requested: true };
	}
};
