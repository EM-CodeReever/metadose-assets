import { fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { listObjectTypes, updateObjectType } from '$lib/server/services/objectTypes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	// Components check out into an asset, never to a person — "confirm receipt" never applies to
	// them, so a EULA on one would be meaningless.
	const objectTypes = (await listObjectTypes(organization.id)).filter((t) => t.builtinKind !== 'component');
	return { objectTypes };
};

export const actions: Actions = {
	save: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);

		const formData = await event.request.formData();
		const objectTypeId = formData.get('objectTypeId')?.toString() ?? '';
		const eulaEnabled = formData.get('eulaEnabled') === 'on';
		const eulaText = formData.get('eulaText')?.toString().trim();

		const permissionError = await requireOrgPermissionOrFail(
			event,
			orgMembership,
			{ objectType: ['update'] },
			{ objectTypeId }
		);
		if (permissionError) return permissionError;

		if (!objectTypeId) return fail(400, { message: 'Missing object type', objectTypeId });
		if (eulaEnabled && !eulaText) {
			return fail(400, { message: 'Write the agreement text before requiring it', objectTypeId });
		}

		await updateObjectType(
			orgMembership.organization.id,
			objectTypeId,
			{ eulaEnabled, eulaText: eulaText || null },
			user.id
		);
		return { success: true, objectTypeId };
	}
};
