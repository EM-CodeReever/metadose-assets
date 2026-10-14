import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		throw redirect(302, '/');
	}
	const token = event.url.searchParams.get('token') ?? '';
	const invalid = event.url.searchParams.get('error') === 'INVALID_TOKEN' || !token;
	return { token, invalid };
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const token = formData.get('token')?.toString() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

		if (!token) return fail(400, { message: 'This reset link is invalid or has expired' });
		if (newPassword.length < 8) return fail(400, { message: 'Password must be at least 8 characters' });
		if (newPassword !== confirmPassword) return fail(400, { message: 'Passwords do not match' });

		try {
			await auth.api.resetPassword({ body: { newPassword, token } });
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { message: err.message || 'This reset link is invalid or has expired' });
			}
			throw err;
		}

		throw redirect(302, '/login');
	}
};
