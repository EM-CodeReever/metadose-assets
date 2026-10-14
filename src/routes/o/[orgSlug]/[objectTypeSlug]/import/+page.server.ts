import { error, fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { getObjectTypeBySlug } from '$lib/server/services/objectTypes';
import { importRecords, MAX_IMPORT_ROWS } from '$lib/server/services/recordImport';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const objectType = await getObjectTypeBySlug(organization.id, event.params.objectTypeSlug);
	if (!objectType) throw error(404, 'Object type not found');
	return { organization, objectType };
};

export const actions: Actions = {
	import: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['create'] });
		if (permissionError) return permissionError;

		const objectType = await getObjectTypeBySlug(orgMembership.organization.id, event.params.objectTypeSlug);
		if (!objectType) throw error(404, 'Object type not found');

		const formData = await event.request.formData();
		let mapping: Record<string, string>;
		let rows: Record<string, string>[];
		try {
			mapping = JSON.parse(formData.get('mapping')?.toString() ?? '{}');
			rows = JSON.parse(formData.get('rows')?.toString() ?? '[]');
		} catch {
			return fail(400, { message: 'Could not read the uploaded file' });
		}

		if (!Array.isArray(rows) || rows.length === 0) {
			return fail(400, { message: 'No rows to import' });
		}
		if (rows.length > MAX_IMPORT_ROWS) {
			return fail(400, { message: `Import is limited to ${MAX_IMPORT_ROWS} rows at a time (file has ${rows.length})` });
		}

		const { results, created, failed } = await importRecords({
			organizationId: orgMembership.organization.id,
			objectTypeId: objectType.id,
			rows,
			mapping,
			createdBy: user.id
		});

		return { success: true, created, failed, errors: results.filter((r) => !r.success) };
	}
};
