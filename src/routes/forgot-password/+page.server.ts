import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';

		if (email) {
			// Never surface whether the email exists — better-auth already returns the same
			// response either way; this request is deliberately fire-and-forget on our side too.
			await auth.api.requestPasswordReset({
				body: { email, redirectTo: '/reset-password' }
			});
		}

		return { success: true };
	}
};
