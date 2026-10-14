import { fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { listOpenCheckouts, checkinRecord } from '$lib/server/services/checkouts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const checkouts = await listOpenCheckouts(organization.id);
	return { organization, checkouts };
};

export const actions: Actions = {
	checkin: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['checkin'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const checkoutId = formData.get('checkoutId')?.toString();
		if (!checkoutId) return fail(400, { message: 'Missing checkout' });

		try {
			await checkinRecord({ organizationId: orgMembership.organization.id, checkoutId, checkedInBy: user.id });
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not check in record' });
		}
		return { success: true };
	}
};
