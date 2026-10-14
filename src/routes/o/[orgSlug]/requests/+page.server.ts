import { fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { approveCheckoutRequest, listPendingCheckoutRequests, rejectCheckoutRequest } from '$lib/server/services/checkoutRequests';
import { rulesFor } from '$lib/server/services/checkouts';
import { listLocations } from '$lib/server/services/locations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const [requests, locations] = await Promise.all([
		listPendingCheckoutRequests(organization.id),
		listLocations(organization.id)
	]);
	return {
		organization,
		requests: requests.map((r) => ({ ...r, rules: rulesFor(r.record.objectType) })),
		locations
	};
};

export const actions: Actions = {
	approve: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { checkoutRequest: ['approve'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const requestId = formData.get('requestId')?.toString();
		const assignedToLocationId = formData.get('assignedToLocationId')?.toString() || undefined;
		const quantityRaw = formData.get('quantity')?.toString();
		const dueAtRaw = formData.get('dueAt')?.toString();
		if (!requestId) return fail(400, { message: 'Missing request' });

		let dueAt: Date | undefined;
		if (dueAtRaw) {
			dueAt = new Date(dueAtRaw);
			if (Number.isNaN(dueAt.getTime())) return fail(400, { message: 'Enter a valid due date' });
		}

		try {
			await approveCheckoutRequest(orgMembership.organization.id, requestId, user.id, {
				assignedToLocationId,
				quantity: quantityRaw ? Number(quantityRaw) : undefined,
				dueAt
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not approve request' });
		}

		return { success: true };
	},

	reject: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { checkoutRequest: ['reject'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const requestId = formData.get('requestId')?.toString();
		const decisionNote = formData.get('decisionNote')?.toString().trim() || undefined;
		if (!requestId) return fail(400, { message: 'Missing request' });

		try {
			await rejectCheckoutRequest(orgMembership.organization.id, requestId, user.id, decisionNote);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not reject request' });
		}

		return { success: true };
	}
};
