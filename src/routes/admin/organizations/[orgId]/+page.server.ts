import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { db } from '$lib/server/db';
import { organization as organizationTable, member as memberTable } from '$lib/server/db/schema';
import { requireSuperAdmin } from '$lib/server/authz';
import { ensureBuiltinObjectTypes } from '$lib/server/services/objectTypes';
import { addUserToOrganization, assertNotLastOwner } from '$lib/server/services/members';
import { logActivity } from '$lib/server/services/activityLog';
import type { Actions, PageServerLoad } from './$types';

const ORG_ROLES = ['owner', 'admin', 'manager', 'viewer', 'member'] as const;
type OrgRole = (typeof ORG_ROLES)[number];
function parseOrgRole(value: string | undefined, fallback: OrgRole): OrgRole {
	return (ORG_ROLES as readonly string[]).includes(value ?? '') ? (value as OrgRole) : fallback;
}

export const load: PageServerLoad = async (event) => {
	const organization = await db.query.organization.findFirst({
		where: eq(organizationTable.id, event.params.orgId),
		with: { members: { with: { user: true } } }
	});
	if (!organization) throw error(404, 'Organization not found');

	const allUsers = await db.query.user.findMany({ orderBy: (u, { asc }) => asc(u.email) });

	return { organization, allUsers };
};

/**
 * `updateMemberRole`/`removeMember` are handled with direct writes to the `member`
 * table rather than `auth.api.updateMemberRole`/`removeMember`, because those
 * endpoints require the *caller* to already be a member of the target organization
 * (via `orgSessionMiddleware`) — which an instance super-admin managing many
 * organizations from this console generally isn't. `addMember` doesn't have that
 * restriction when `organizationId` is passed explicitly, so it goes through the
 * better-auth API as usual.
 */

export const actions: Actions = {
	provisionBuiltins: async (event) => {
		const user = requireSuperAdmin(event);
		await ensureBuiltinObjectTypes(event.params.orgId, user.id);
		return { success: true };
	},

	addMember: async (event) => {
		const actor = requireSuperAdmin(event);
		const formData = await event.request.formData();
		const role = parseOrgRole(formData.get('role')?.toString(), 'viewer');

		let userIds: string[];
		try {
			userIds = JSON.parse(formData.get('userIds')?.toString() ?? '[]');
		} catch {
			return fail(400, { message: 'Invalid selection' });
		}
		if (!Array.isArray(userIds) || userIds.length === 0) return fail(400, { message: 'Select at least one user' });

		const results: { userId: string; success: boolean; message?: string }[] = [];
		for (const userId of userIds) {
			try {
				await addUserToOrganization(event.params.orgId, userId, role, event.request.headers, actor.id);
				results.push({ userId, success: true });
			} catch (err) {
				const message = err instanceof APIError ? err.message : err instanceof Error ? err.message : 'Could not add member';
				results.push({ userId, success: false, message });
			}
		}

		const failed = results.filter((r) => !r.success);
		if (failed.length > 0 && failed.length === results.length) {
			return fail(400, { message: failed[0].message ?? 'Could not add any of the selected users' });
		}

		return {
			success: true,
			added: results.length - failed.length,
			failed: failed.length,
			errors: failed
		};
	},

	updateRole: async (event) => {
		const actor = requireSuperAdmin(event);
		const formData = await event.request.formData();
		const memberId = formData.get('memberId')?.toString();
		const roleInput = formData.get('role')?.toString();
		if (!memberId || !roleInput || !(ORG_ROLES as readonly string[]).includes(roleInput)) {
			return fail(400, { message: 'Missing member or invalid role' });
		}

		try {
			await assertNotLastOwner(event.params.orgId, memberId);
			const target = await db.query.member.findFirst({ where: eq(memberTable.id, memberId), with: { user: true } });
			await db.update(memberTable).set({ role: roleInput }).where(eq(memberTable.id, memberId));
			await logActivity(db, {
				organizationId: event.params.orgId,
				actorUserId: actor.id,
				action: 'member.role_changed',
				summary: `${target?.user.name ?? 'A member'}'s role changed from ${target?.role} to ${roleInput}`,
				changes: { before: { role: target?.role }, after: { role: roleInput } }
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not update role' });
		}
		return { success: true };
	},

	removeMember: async (event) => {
		const actor = requireSuperAdmin(event);
		const formData = await event.request.formData();
		const memberId = formData.get('memberId')?.toString();
		if (!memberId) return fail(400, { message: 'Missing member' });

		try {
			await assertNotLastOwner(event.params.orgId, memberId);
			const target = await db.query.member.findFirst({ where: eq(memberTable.id, memberId), with: { user: true } });
			await db.delete(memberTable).where(eq(memberTable.id, memberId));
			await logActivity(db, {
				organizationId: event.params.orgId,
				actorUserId: actor.id,
				action: 'member.removed',
				summary: `${target?.user.name ?? 'A member'} removed from the organization`
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not remove member' });
		}
		return { success: true };
	}
};
