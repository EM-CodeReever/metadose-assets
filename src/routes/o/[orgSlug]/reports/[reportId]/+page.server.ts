import { error, fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, resolveOrgMembership } from '$lib/server/authz';
import {
	getReportDefinition,
	renameReportDefinition,
	runReport,
	updateReportConfig,
	type ReportConfig
} from '$lib/server/services/reports';
import { listOrgUsers } from '$lib/server/services/members';
import { listAllLookupValues } from '$lib/server/services/lookupValues';
import { listLocations } from '$lib/server/services/locations';
import type { FilterCondition } from '$lib/reportFilters';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const report = await getReportDefinition(organization.id, event.params.reportId);
	if (!report) throw error(404, 'Report not found');

	const [result, orgUsers, lookupValues, locations] = await Promise.all([
		runReport(organization.id, report.objectTypeId, report.objectType.fields, report.config),
		listOrgUsers(organization.id),
		listAllLookupValues(organization.id),
		listLocations(organization.id)
	]);

	return { organization, report, result, orgUsers, lookupValues, locations };
};

export const actions: Actions = {
	update: async (event) => {
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { report: ['update'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const columns = formData.getAll('cols').map(String);

		let filters: FilterCondition[] = [];
		try {
			const raw = JSON.parse(formData.get('filtersJson')?.toString() ?? '[]');
			if (Array.isArray(raw)) filters = raw;
		} catch {
			return fail(400, { message: 'Could not read the filter configuration' });
		}

		const config: ReportConfig = {
			columns,
			filters,
			sortKey: formData.get('sortKey')?.toString() || undefined,
			sortDirection: formData.get('sortDir')?.toString() === 'asc' ? 'asc' : undefined,
			groupBy: formData.get('groupBy')?.toString() || undefined,
			aggregateField: formData.get('aggregateField')?.toString() || undefined
		};

		await updateReportConfig(orgMembership.organization.id, event.params.reportId, config);
		return { success: true };
	},

	rename: async (event) => {
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { report: ['update'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim();
		if (!name) return fail(400, { message: 'Name is required' });

		await renameReportDefinition(orgMembership.organization.id, event.params.reportId, name);
		return { success: true };
	}
};
