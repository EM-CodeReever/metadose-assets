import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/authz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	// Nothing to do here once the flag is already clear — send them on to their normal landing
	// page instead of showing a stale "change your password" form.
	if (!user.mustChangePassword) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);

		const formData = await event.request.formData();
		const currentPassword = formData.get('currentPassword')?.toString() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

		if (!currentPassword) return fail(400, { message: 'Enter your current password' });
		if (newPassword.length < 8) return fail(400, { message: 'New password must be at least 8 characters' });
		if (newPassword !== confirmPassword) return fail(400, { message: 'Passwords do not match' });

		try {
			await auth.api.changePassword({
				headers: event.request.headers,
				body: { currentPassword, newPassword, revokeOtherSessions: true }
			});
		} catch (err) {
			if (err instanceof APIError) return fail(400, { message: err.message || 'Could not change password' });
			throw err;
		}

		await db.update(userTable).set({ mustChangePassword: false }).where(eq(userTable.id, user.id));

		throw redirect(302, '/');
	}
};
