import { randomBytes } from 'node:crypto';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { requireSuperAdmin } from '$lib/server/authz';
import { deleteUserAccount } from '$lib/server/services/userDeletion';
import type { Actions, PageServerLoad } from './$types';

/** Never shown to anyone — used only to satisfy createUser's required credential when the admin
 *  chooses to email the new user a set-your-own-password link instead of setting one directly. */
function generateTempPassword(): string {
	return randomBytes(16).toString('base64url');
}

export const load: PageServerLoad = async () => {
	const users = await db.query.user.findMany({
		orderBy: (u, { asc }) => asc(u.email),
		with: { members: { with: { organization: true } } }
	});
	return { users };
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
					data: credentialMethod === 'password' ? { mustChangePassword: requirePasswordChange } : undefined
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
		requireSuperAdmin(event);
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();
		const banReason = formData.get('banReason')?.toString().trim() || undefined;
		if (!userId) return fail(400, { message: 'Missing user' });

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
	}
};
