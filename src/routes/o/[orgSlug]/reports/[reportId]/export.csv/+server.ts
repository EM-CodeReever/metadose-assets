import { error } from '@sveltejs/kit';
import { resolveOrgMembership } from '$lib/server/authz';
import { getReportDefinition, runReport, toCsv } from '$lib/server/services/reports';
import { listOrgUsers } from '$lib/server/services/members';
import { listAllLookupValues } from '$lib/server/services/lookupValues';
import type { RequestHandler } from './$types';

// Read-only export — gated by org membership only (same as viewing the report itself),
// not a stricter permission, since anyone who can view a report can already see its data.
export const GET: RequestHandler = async (event) => {
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);

	const report = await getReportDefinition(orgMembership.organization.id, event.params.reportId);
	if (!report) throw error(404, 'Report not found');

	const [result, orgUsers, lookupValues] = await Promise.all([
		runReport(orgMembership.organization.id, report.objectTypeId, report.objectType.fields, report.config),
		listOrgUsers(orgMembership.organization.id),
		listAllLookupValues(orgMembership.organization.id)
	]);

	const orgUserNames = new Map(orgUsers.map((u) => [u.id, u.name]));
	const lookupNames = new Map(Object.values(lookupValues).flat().map((v) => [v.id, v.name]));

	const csv = toCsv(report.objectType.fields, report.config.columns, result, orgUserNames, lookupNames);
	const fileName = `${report.name.replace(/[^a-zA-Z0-9-_]+/g, '_')}.csv`;

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${fileName}"`
		}
	});
};
