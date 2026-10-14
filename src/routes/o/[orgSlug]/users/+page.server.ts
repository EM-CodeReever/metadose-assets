import { requireOrgRole, resolveOrgMembership } from '$lib/server/authz';
import { listOrgMembers } from '$lib/server/services/members';
import { db } from '$lib/server/db';
import { checkout } from '$lib/server/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
	requireOrgRole(orgMembership, 'admin');

	const members = await listOrgMembers(orgMembership.organization.id);

	const openCounts = await db
		.select({ userId: checkout.assignedToUserId, count: sql<number>`count(*)` })
		.from(checkout)
		.where(
			and(
				eq(checkout.organizationId, orgMembership.organization.id),
				eq(checkout.assignedToType, 'user'),
				isNull(checkout.checkedInAt)
			)
		)
		.groupBy(checkout.assignedToUserId);
	const openCountByUser = new Map(openCounts.map((c) => [c.userId, Number(c.count)]));

	return {
		organization: orgMembership.organization,
		members: members.map((m) => ({ ...m, openCheckoutCount: openCountByUser.get(m.userId) ?? 0 }))
	};
};
