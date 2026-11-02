import { randomBytes } from 'node:crypto';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { requireSuperAdmin } from '$lib/server/authz';
import { deleteUserAccount } from '$lib/server/services/userDeletion';
import { getInstanceSettings } from '$lib/server/services/settings';
import type { Actions, PageServerLoad } from './$types';

interface BulkActionResult {
	userId: string;
	name?: string;
	success: boolean;
	message?: string;
}

/** Never shown to anyone — used only to satisfy createUser's required credential when the admin
 *  chooses to email the new user a set-your-own-password link instead of setting one directly. */
function generateTempPassword(): string {
	return randomBytes(16).toString('base64url');
}

export const load: PageServerLoad = async () => {
	const [users, settings] = await Promise.all([
		db.query.user.findMany({
			orderBy: (u, { asc }) => asc(u.email),
			with: { members: { with: { organization: true } } }
		}),
		getInstanceSettings()
	]);
	return { users, ldapEnabled: settings?.ldapEnabled ?? false };
};

async function getTargetUser(userId: string) {
	return db.query.user.findFirst({ where: eq(userTable.id, userId) });
}

export const actions: Actions = {
	create: async (event) => {
		requireSuperAdmin(event);
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const email = formData.get('email')?.toString().trim() ?? '';
		const accountType = formData.get('accountType')?.toString() === 'admin' ? 'admin' : 'user';
		const credentialMethod = formData.get('credentialMethod')?.toString() === 'email_link' ? 'email_link' : 'password';
		const requirePasswordChange = formData.get('requirePasswordChange') === 'on';

		if (!name || !email) {
			return fail(400, { message: 'Name and email are required' });
		}

		let password: string;
		if (credentialMethod === 'password') {
			password = formData.get('password')?.toString() ?? '';
			if (password.length < 8) return fail(400, { message: 'Password must be at least 8 characters' });
		} else {
			// The account still needs a real credential row for the reset-password email flow to
			// have something to act on — this value is never shown or usable as-is.
			password = generateTempPassword();
		}

		try {
			await auth.api.createUser({
				headers: event.request.headers,
				body: {
					name,
					email,
					password,
					role: accountType === 'admin' ? 'super_admin' : 'user',
					// Not a public signup — an instance admin typed this address themselves, so
					// there's no verification flow in this app to ever clear it otherwise.
					data: {
						emailVerified: true,
						...(credentialMethod === 'password' ? { mustChangePassword: requirePasswordChange } : {})
					}
				}
			});

			if (credentialMethod === 'email_link') {
				await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
			}
		} catch (err) {
			if (err instanceof APIError) return fail(400, { message: err.message || 'Could not create user' });
			throw err;
		}
		return { success: true, emailedLinkTo: credentialMethod === 'email_link' ? email : undefined };
	},

	resetPassword: async (event) => {
		requireSuperAdmin(event);
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();
		if (!userId) return fail(400, { message: 'Missing user' });

		const target = await getTargetUser(userId);
		if (!target) return fail(404, { message: 'User not found' });
		if (target.authSource !== 'local') {
			return fail(400, { message: 'This account authenticates via LDAP — reset the password in the directory instead' });
		}

		try {
			await auth.api.requestPasswordReset({ body: { email: target.email, redirectTo: '/reset-password' } });
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not send password reset' });
		}
		return { success: true, resetSentFor: userId };
	},

	ban: async (event) => {
		const actor = requireSuperAdmin(event);
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();
		const banReason = formData.get('banReason')?.toString().trim() || undefined;
		if (!userId) return fail(400, { message: 'Missing user' });
		if (userId === actor.id) return fail(400, { message: "You can't ban your own account" });

		try {
			await auth.api.banUser({ headers: event.request.headers, body: { userId, banReason } });
		} catch (err) {
			if (err instanceof APIError) return fail(400, { message: err.message });
			return fail(400, { message: err instanceof Error ? err.message : 'Could not ban user' });
		}
		return { success: true };
	},

	unban: async (event) => {
		requireSuperAdmin(event);
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();
		if (!userId) return fail(400, { message: 'Missing user' });

		try {
			await auth.api.unbanUser({ headers: event.request.headers, body: { userId } });
		} catch (err) {
			if (err instanceof APIError) return fail(400, { message: err.message });
			return fail(400, { message: err instanceof Error ? err.message : 'Could not unban user' });
		}
		return { success: true };
	},

	deleteUser: async (event) => {
		const actor = requireSuperAdmin(event);
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();
		if (!userId) return fail(400, { message: 'Missing user' });

		try {
			const { mode } = await deleteUserAccount(userId, actor.id, event.request.headers);
			return { success: true, deleteMode: mode };
		} catch (err) {
			if (err instanceof APIError) return fail(400, { message: err.message });
			return fail(400, { message: err instanceof Error ? err.message : 'Could not delete user' });
		}
	},

	bulkBan: async (event) => {
		const actor = requireSuperAdmin(event);
		const formData = await event.request.formData();
		let userIds: string[];
		try {
			userIds = JSON.parse(formData.get('userIds')?.toString() ?? '[]');
		} catch {
			return fail(400, { message: 'Invalid selection' });
		}
		if (!Array.isArray(userIds) || userIds.length === 0) return fail(400, { message: 'No users selected' });

		const results: BulkActionResult[] = [];
		for (const userId of userIds) {
			const target = await getTargetUser(userId);
			if (userId === actor.id) {
				results.push({ userId, name: target?.name, success: false, message: "You can't ban your own account" });
				continue;
			}
			try {
				await auth.api.banUser({ headers: event.request.headers, body: { userId } });
				results.push({ userId, name: target?.name, success: true });
			} catch (err) {
				const message = err instanceof APIError ? err.message : err instanceof Error ? err.message : 'Could not ban user';
				results.push({ userId, name: target?.name, success: false, message });
			}
		}

		return {
			success: true,
			bulkAction: 'ban' as const,
			succeeded: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
			errors: results.filter((r) => !r.success)
		};
	},

	bulkDelete: async (event) => {
		const actor = requireSuperAdmin(event);
		const formData = await event.request.formData();
		let userIds: string[];
		try {
			userIds = JSON.parse(formData.get('userIds')?.toString() ?? '[]');
		} catch {
			return fail(400, { message: 'Invalid selection' });
		}
		if (!Array.isArray(userIds) || userIds.length === 0) return fail(400, { message: 'No users selected' });

		const results: BulkActionResult[] = [];
		for (const userId of userIds) {
			const target = await getTargetUser(userId);
			try {
				await deleteUserAccount(userId, actor.id, event.request.headers);
				results.push({ userId, name: target?.name, success: true });
			} catch (err) {
				const message = err instanceof APIError ? err.message : err instanceof Error ? err.message : 'Could not delete user';
				results.push({ userId, name: target?.name, success: false, message });
			}
		}

		return {
			success: true,
			bulkAction: 'delete' as const,
			succeeded: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
			errors: results.filter((r) => !r.success)
		};
	}
};
