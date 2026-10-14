import { fail, redirect } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { listObjectTypes } from '$lib/server/services/objectTypes';
import { createReportDefinition, deleteReportDefinition, listReportDefinitions } from '$lib/server/services/reports';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const [reports, objectTypes] = await Promise.all([
		listReportDefinitions(organization.id),
		listObjectTypes(organization.id)
	]);
	return { organization, reports, objectTypes };
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { report: ['create'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const objectTypeId = formData.get('objectTypeId')?.toString();

		if (!name) return fail(400, { message: 'Name is required' });
		if (!objectTypeId) return fail(400, { message: 'Choose an object type' });

		const reportId = await createReportDefinition({
			organizationId: orgMembership.organization.id,
			objectTypeId,
			name,
			createdBy: user.id
		});

		throw redirect(303, `/o/${event.params.orgSlug}/reports/${reportId}`);
	},

	delete: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { report: ['delete'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const reportId = formData.get('reportId')?.toString();
		if (!reportId) return fail(400, { message: 'Missing report' });

		await deleteReportDefinition(orgMembership.organization.id, reportId, user.id);
		return { success: true };
	}
};
