import { requireOrgRole, resolveOrgMembership } from '$lib/server/authz';
import { ACTIVITY_CATEGORIES, listActivity, listDistinctActions } from '$lib/server/services/activityLog';
import { listOrgUsers } from '$lib/server/services/members';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
	requireOrgRole(orgMembership, 'viewer');

	const params = event.url.searchParams;
	const category = params.get('category') || undefined;
	const action = params.get('action') || undefined;
	const actorUserId = params.get('actor') || undefined;
	const search = params.get('q') || undefined;
	const fromRaw = params.get('from');
	const toRaw = params.get('to');
	const page = Math.max(1, Number(params.get('page')) || 1);

	const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : undefined;
	const to = toRaw ? new Date(`${toRaw}T23:59:59.999`) : undefined;

	const [{ rows, total, pageSize }, actions, orgUsers] = await Promise.all([
		listActivity(orgMembership.organization.id, { category, action, actorUserId, search, from, to, page }),
		listDistinctActions(orgMembership.organization.id),
		listOrgUsers(orgMembership.organization.id)
	]);

	return {
		organization: orgMembership.organization,
		entries: rows,
		total,
		page,
		pageSize,
		categories: ACTIVITY_CATEGORIES,
		actions,
		orgUsers,
		filters: { category, action, actorUserId, search, from: fromRaw ?? '', to: toRaw ?? '' }
	};
};
