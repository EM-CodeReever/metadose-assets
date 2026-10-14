import { requireUser, resolveOrgMembership } from '$lib/server/authz';
import { SINGLETON_KINDS, getSingletonObjectType, listObjectTypes } from '$lib/server/services/objectTypes';
import { listMyOrganizations } from '$lib/server/services/members';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const { organization, membership, isSuperAdminAccess } = await resolveOrgMembership(
		event,
		event.params.orgSlug
	);

	const [singletons, customObjectTypes, myOrganizations] = await Promise.all([
		Promise.all(SINGLETON_KINDS.map((kind) => getSingletonObjectType(organization.id, kind))),
		listObjectTypes(organization.id, { kind: 'custom' }),
		// Only meaningful for a real member switching between their own orgs — a super-admin's
		// read-through "support access" isn't scoped to a fixed list of orgs to pick from.
		isSuperAdminAccess ? Promise.resolve([]) : listMyOrganizations(user.id)
	]);

	const singletonSlugs = Object.fromEntries(
		SINGLETON_KINDS.map((kind, i) => [kind, singletons[i]?.slug ?? kind])
	) as Record<(typeof SINGLETON_KINDS)[number], string>;

	return { user, organization, membership, isSuperAdminAccess, singletonSlugs, customObjectTypes, myOrganizations };
};
