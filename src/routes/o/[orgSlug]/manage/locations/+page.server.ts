import { fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { createLocation, deleteLocation, listLocations } from '$lib/server/services/locations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const locations = await listLocations(organization.id);
	return { organization, locations };
};

export const actions: Actions = {
	add: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['checkout'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const address = formData.get('address')?.toString().trim();
		if (!name) return fail(400, { message: 'Name is required' });

		await createLocation({
			organizationId: orgMembership.organization.id,
			name,
			address: address || undefined,
			actorUserId: user.id
		});
		return { success: true };
	},

	delete: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['checkout'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const locationId = formData.get('locationId')?.toString();
		if (!locationId) return fail(400, { message: 'Missing location' });

		await deleteLocation(orgMembership.organization.id, locationId, user.id);
		return { success: true };
	}
};
