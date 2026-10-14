import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organization as organizationTable, member as memberTable } from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';

export type AuthenticatedUser = NonNullable<RequestEvent['locals']['user']>;

// Routes a user with `mustChangePassword` set must still be able to reach — otherwise they
// could never get to the one page that clears the flag, or sign out while stuck.
const CHANGE_PASSWORD_EXEMPT_PATHS = ['/change-password', '/logout'];

export function requireUser(event: RequestEvent): AuthenticatedUser {
	if (!event.locals.user) {
		// `as=admin` just pre-selects the "INT Admin" tab on the shared login page for a path
		// under /admin — it's a UX hint, not a security boundary (the login form itself decides
		// which credential check runs based on which tab was actually submitted).
		const asHint = event.url.pathname.startsWith('/admin') ? '&as=admin' : '';
		throw redirect(302, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}${asHint}`);
	}
	if (event.locals.user.mustChangePassword && !CHANGE_PASSWORD_EXEMPT_PATHS.includes(event.url.pathname)) {
		throw redirect(302, '/change-password');
	}
	return event.locals.user;
}

export function requireSuperAdmin(event: RequestEvent): AuthenticatedUser {
	const user = requireUser(event);
	if (user.role !== 'super_admin') {
		throw error(403, 'Super admin access required');
	}
	return user;
}

export interface OrgMembership {
	organization: typeof organizationTable.$inferSelect;
	membership: typeof memberTable.$inferSelect | undefined;
	isSuperAdminAccess: boolean;
}

/**
 * Resolves an organization by its URL slug and the current user's membership in it.
 * Reads the `organization`/`member` tables directly (rather than calling
 * `auth.api.getFullOrganization`, which 403s outright for non-members) so a
 * super-admin can still get read-through support access to any organization.
 */
export async function resolveOrgMembership(event: RequestEvent, orgSlug: string): Promise<OrgMembership> {
	const user = requireUser(event);

	const organization = await db.query.organization.findFirst({
		where: eq(organizationTable.slug, orgSlug)
	});
	if (!organization) throw error(404, 'Organization not found');

	const membership = await db.query.member.findFirst({
		where: and(eq(memberTable.organizationId, organization.id), eq(memberTable.userId, user.id))
	});

	const isSuperAdminAccess = !membership && user.role === 'super_admin';
	if (!membership && !isSuperAdminAccess) {
		throw error(403, 'You are not a member of this organization');
	}

	return { organization, membership, isSuperAdminAccess };
}

const ORG_ROLE_RANK: Record<string, number> = { member: -1, viewer: 0, manager: 1, admin: 2, owner: 3 };

/** Coarse role-hierarchy check, for gating whole routes (e.g. "manager or above"). */
export function requireOrgRole(
	{ membership, isSuperAdminAccess }: OrgMembership,
	minRole: keyof typeof ORG_ROLE_RANK
) {
	if (isSuperAdminAccess) return;
	const rank = membership ? (ORG_ROLE_RANK[membership.role] ?? -1) : -1;
	if (rank < ORG_ROLE_RANK[minRole]) {
		throw error(403, 'Insufficient permissions for this organization');
	}
}

async function hasOrgPermission(
	event: RequestEvent,
	{ organization, isSuperAdminAccess }: OrgMembership,
	permissions: Record<string, string[]>
): Promise<boolean> {
	if (isSuperAdminAccess) return true;
	const result = await auth.api.hasPermission({
		headers: event.request.headers,
		body: { organizationId: organization.id, permissions }
	});
	return result.success;
}

/**
 * Fine-grained permission check against the custom access-control resources defined in
 * `$lib/server/permissions.ts` (objectType/record/report/attachment). Throws a full 403 —
 * appropriate for `load` functions and `+server.ts` endpoints, where there's no current page
 * to show an inline error on. Form actions should use `requireOrgPermissionOrFail` instead.
 */
export async function requireOrgPermission(
	event: RequestEvent,
	membership: OrgMembership,
	permissions: Record<string, string[]>
) {
	if (!(await hasOrgPermission(event, membership, permissions))) {
		throw error(403, 'Insufficient permissions for this action');
	}
}

/**
 * Same check as `requireOrgPermission`, but for use inside form `actions`: returns a `fail(403,
 * ...)` to `return` from the action instead of throwing, so a denied save shows inline via the
 * page's existing `form?.message` alert rather than replacing the whole page with the error
 * boundary — the same reason every other action failure here uses `fail`, not `error`.
 */
export async function requireOrgPermissionOrFail<T extends Record<string, unknown> = Record<string, never>>(
	event: RequestEvent,
	membership: OrgMembership,
	permissions: Record<string, string[]>,
	extra?: T
) {
	if (await hasOrgPermission(event, membership, permissions)) return undefined;
	return fail(403, { message: "You don't have permission to do that", ...(extra as T) });
}
