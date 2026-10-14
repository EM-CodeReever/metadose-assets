import { fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import {
	createLookupValue,
	deleteLookupValue,
	listLookupValues,
	setLookupValueOutOfService
} from '$lib/server/services/lookupValues';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const values = await listLookupValues(organization.id, 'condition');
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
		const outOfService = formData.get('outOfService') === 'on';

		try {
			await createLookupValue(orgMembership.organization.id, 'condition', name, outOfService, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not add condition' });
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
		if (!id) return fail(400, { message: 'Missing condition' });

		await deleteLookupValue(orgMembership.organization.id, id, user.id);
		return { success: true };
	},

	setOutOfService: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString();
		const outOfService = formData.get('outOfService') === 'true';
		if (!id) return fail(400, { message: 'Missing condition' });

		await setLookupValueOutOfService(orgMembership.organization.id, id, outOfService, user.id);
		return { success: true };
	}
};
