import { error, fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { member as memberTable } from '$lib/server/db/schema';
import { requireOrgRole, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { assertNotLastOwner, getOrgMember } from '$lib/server/services/members';
import { listCheckoutsForUser } from '$lib/server/services/checkouts';
import { listMyCheckoutRequests } from '$lib/server/services/checkoutRequests';
import { listActivity, logActivity } from '$lib/server/services/activityLog';
import type { Actions, PageServerLoad } from './$types';

const ORG_ROLES = ['owner', 'admin', 'manager', 'viewer', 'member'] as const;

export const load: PageServerLoad = async (event) => {
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
	requireOrgRole(orgMembership, 'admin');

	const member = await getOrgMember(orgMembership.organization.id, event.params.memberId);
	if (!member) throw error(404, 'Member not found');

	const [checkouts, requests, activity] = await Promise.all([
		listCheckoutsForUser(orgMembership.organization.id, member.userId),
		listMyCheckoutRequests(orgMembership.organization.id, member.userId),
		listActivity(orgMembership.organization.id, { actorUserId: member.userId, pageSize: 8 })
	]);

	return {
		organization: orgMembership.organization,
		member,
		checkouts,
		requests,
		recentActivity: activity.rows,
		orgRoles: ORG_ROLES
	};
};

/**
 * Instance super-admins are managed from the Instance Admin console, not by an org admin —
 * their account carries systemwide power that isn't scoped to this one org, so an org admin
 * resetting their password (or demoting/removing them here) would be reaching outside their
 * actual authority. Visible on the Users page for transparency, just not actionable here.
 */
function assertNotInstanceAdmin(member: { user: { role: string | null } }): void {
	if (member.user.role === 'super_admin') {
		throw new Error('This account is an instance super-admin — manage it from the Instance Admin console instead');
	}
}

export const actions: Actions = {
	updateRole: async (event) => {
		const actor = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		requireOrgRole(orgMembership, 'admin');

		const formData = await event.request.formData();
		const role = formData.get('role')?.toString();
		if (!role || !(ORG_ROLES as readonly string[]).includes(role)) {
			return fail(400, { message: 'Invalid role' });
		}

		const member = await getOrgMember(orgMembership.organization.id, event.params.memberId);
		if (!member) return fail(404, { message: 'Member not found' });

		try {
			assertNotInstanceAdmin(member);
			await assertNotLastOwner(orgMembership.organization.id, member.id);
			if (orgMembership.isSuperAdminAccess) {
				// `auth.api.updateMemberRole` requires the caller to already be a member of this
				// org (checked via session headers) — an instance admin visiting via support
				// access isn't, so fall back to the same direct write the admin console uses.
				await db.update(memberTable).set({ role }).where(eq(memberTable.id, member.id));
			} else {
				await auth.api.updateMemberRole({
					headers: event.request.headers,
					body: { memberId: member.id, role, organizationId: orgMembership.organization.id }
				});
			}
			await logActivity(db, {
				organizationId: orgMembership.organization.id,
				actorUserId: actor.id,
				action: 'member.role_changed',
				summary: `${member.user.name}'s role changed from ${member.role} to ${role}`,
				changes: { before: { role: member.role }, after: { role } }
			});
		} catch (err) {
			if (err instanceof APIError) return fail(400, { message: err.message });
			return fail(400, { message: err instanceof Error ? err.message : 'Could not update role' });
		}
		return { success: true };
	},

	remove: async (event) => {
		const actor = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		requireOrgRole(orgMembership, 'admin');

		const member = await getOrgMember(orgMembership.organization.id, event.params.memberId);
		if (!member) return fail(404, { message: 'Member not found' });

		try {
			assertNotInstanceAdmin(member);
			await assertNotLastOwner(orgMembership.organization.id, member.id);
			if (orgMembership.isSuperAdminAccess) {
				await db.delete(memberTable).where(eq(memberTable.id, member.id));
			} else {
				await auth.api.removeMember({
					headers: event.request.headers,
					body: { memberIdOrEmail: member.id, organizationId: orgMembership.organization.id }
				});
			}
			await logActivity(db, {
				organizationId: orgMembership.organization.id,
				actorUserId: actor.id,
				action: 'member.removed',
				summary: `${member.user.name} removed from the organization`
			});
		} catch (err) {
			if (err instanceof APIError) return fail(400, { message: err.message });
			return fail(400, { message: err instanceof Error ? err.message : 'Could not remove member' });
		}
		throw redirect(303, `/o/${event.params.orgSlug}/users`);
	},

	sendPasswordReset: async (event) => {
		const actor = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		requireOrgRole(orgMembership, 'admin');

		const member = await getOrgMember(orgMembership.organization.id, event.params.memberId);
		if (!member) return fail(404, { message: 'Member not found' });
		if (member.user.authSource !== 'local') {
			return fail(400, { message: 'This account authenticates via LDAP — reset the password in the directory instead' });
		}

		try {
			assertNotInstanceAdmin(member);
			await auth.api.requestPasswordReset({ body: { email: member.user.email, redirectTo: '/reset-password' } });
			await logActivity(db, {
				organizationId: orgMembership.organization.id,
				actorUserId: actor.id,
				action: 'member.password_reset_sent',
				summary: `Password reset email sent to ${member.user.name}`
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not send password reset' });
		}
		return { success: true, resetSent: true };
	}
};
