import { fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { createLookupValue, deleteLookupValue, listLookupValues } from '$lib/server/services/lookupValues';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const values = await listLookupValues(organization.id, 'manufacturer');
	return { organization, values };
};

export const actions: Actions = {
	add: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString() ?? '';

		try {
			await createLookupValue(orgMembership.organization.id, 'manufacturer', name, false, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not add manufacturer' });
		}

		return { success: true };
	},

	delete: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString();
		if (!id) return fail(400, { message: 'Missing manufacturer' });

		await deleteLookupValue(orgMembership.organization.id, id, user.id);
		return { success: true };
	}
};
