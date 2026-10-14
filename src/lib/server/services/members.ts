import { and, eq, ne } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { member, organization as organizationTable, user as userTable } from '$lib/server/db/schema';
import { sendEmail } from '$lib/server/email';
import { logActivity } from './activityLog';

/** Every organization a user belongs to, for the login org-picker and the in-app org switcher. */
export async function listMyOrganizations(userId: string) {
	const memberships = await db.query.member.findMany({
		where: eq(member.userId, userId),
		with: { organization: true },
		orderBy: (m, { asc }) => asc(m.createdAt)
	});
	return memberships.map((m) => ({ id: m.organization.id, slug: m.organization.slug, name: m.organization.name, role: m.role }));
}

/**
 * Users belonging to an organization, for populating user_reference field dropdowns and the
 * checkout "assign to user" picker. Includes each user's instance-wide `role` so callers that
 * assign checkouts can filter out super-admin accounts (see `checkoutRecord`'s matching guard in
 * `checkouts.ts`) without needing a second query — a generic `user_reference` field still shows
 * everyone, since that restriction is specific to checkout assignment, not this list itself.
 * `orgRole` is the member's role *in this org* (owner/admin/manager/viewer/member) — distinct from
 * `role`, the instance-wide super_admin/user flag — used to badge each option in the searchable
 * "assign to user" picker.
 */
export async function listOrgUsers(organizationId: string) {
	const members = await db.query.member.findMany({
		where: eq(member.organizationId, organizationId),
		with: { user: true }
	});
	return members.map((m) => ({
		id: m.user.id,
		name: m.user.name,
		email: m.user.email,
		role: m.user.role,
		orgRole: m.role
	}));
}

/** Full member rows (with their user record) for the org-side Users directory. */
export async function listOrgMembers(organizationId: string) {
	return db.query.member.findMany({
		where: eq(member.organizationId, organizationId),
		with: { user: true },
		orderBy: (m, { asc }) => asc(m.createdAt)
	});
}

export async function getOrgMember(organizationId: string, memberId: string) {
	return db.query.member.findFirst({
		where: and(eq(member.organizationId, organizationId), eq(member.id, memberId)),
		with: { user: true }
	});
}

/**
 * Guards against demoting/removing an org's only owner, which would leave it with no one able
 * to manage membership at all. Shared by both the instance-admin console and the org-side Users
 * page, since both can change roles/remove members.
 */
export async function assertNotLastOwner(organizationId: string, memberId: string): Promise<void> {
	const target = await db.query.member.findFirst({ where: eq(member.id, memberId) });
	if (!target || target.role !== 'owner') return;
	const otherOwners = await db.query.member.findFirst({
		where: and(eq(member.organizationId, organizationId), eq(member.role, 'owner'), ne(member.id, memberId))
	});
	if (!otherOwners) {
		throw new Error('Cannot remove or demote the only owner of an organization');
	}
}

/**
 * Adds a user to an organization with a role and emails them about it — shared by the single
 * "add member" admin action and every bulk path (CSV user import, LDAP sync) that can also
 * assign people to an org in the same pass. Uses `auth.api.addMember` directly (not
 * `updateMemberRole`/`removeMember`, which require the *caller* to already be a member) since it
 * accepts an explicit `organizationId` regardless of who's calling it.
 */
export type OrgRoleName = 'owner' | 'admin' | 'manager' | 'viewer' | 'member';

export async function addUserToOrganization(
	organizationId: string,
	userId: string,
	role: OrgRoleName,
	requestHeaders: Headers,
	actorUserId?: string
): Promise<void> {
	await auth.api.addMember({
		headers: requestHeaders,
		body: { userId, role, organizationId }
	});

	const [addedUser, organization] = await Promise.all([
		db.query.user.findFirst({ where: eq(userTable.id, userId) }),
		db.query.organization.findFirst({ where: eq(organizationTable.id, organizationId) })
	]);

	await logActivity(db, {
		organizationId,
		actorUserId: actorUserId ?? userId,
		action: 'member.added',
		summary: `${addedUser?.name ?? 'A user'} added as ${role}`
	});

	if (addedUser && organization) {
		await sendEmail({
			to: addedUser.email,
			subject: `You've been added to ${organization.name}`,
			html: `<p>You now have <strong>${role}</strong> access to <strong>${organization.name}</strong>.</p><p><a href="${env.ORIGIN ?? ''}/o/${organization.slug}">Open ${organization.name}</a></p>`
		});
	}
}
