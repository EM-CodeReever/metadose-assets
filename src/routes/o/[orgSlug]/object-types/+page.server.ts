import { fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { createObjectType, listObjectTypes } from '$lib/server/services/objectTypes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const objectTypes = await listObjectTypes(organization.id);
	return { organization, objectTypes };
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['create'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const description = formData.get('description')?.toString().trim();
		const trackingMode = formData.get('trackingMode')?.toString() === 'bulk' ? 'bulk' : 'individual';
		const allowComponentInstall = formData.get('allowComponentInstall') === 'on';

		if (!name) return fail(400, { message: 'Name is required' });

		// Assets/Accessories/Consumables/Components are auto-provisioned singletons (see
		// objectTypes.ensureBuiltinObjectTypes) — anything created from this form is custom.
		await createObjectType({
			organizationId: orgMembership.organization.id,
			name,
			description: description || undefined,
			builtinKind: 'custom',
			createdBy: user.id,
			trackingMode,
			allowComponentInstall
		});

		return { success: true };
	}
};
