import { fail } from '@sveltejs/kit';
import { requireSuperAdmin } from '$lib/server/authz';
import { getInstanceSettings, upsertSmtpSettings } from '$lib/server/services/settings';
import { sendEmail } from '$lib/server/email';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireSuperAdmin(event);
	const settings = await getInstanceSettings();

	return {
		smtp: {
			host: settings?.smtpHost ?? '',
			port: settings?.smtpPort ?? '',
			secure: settings?.smtpSecure ?? false,
			user: settings?.smtpUser ?? '',
			from: settings?.smtpFrom ?? '',
			hasPassword: !!settings?.smtpPass
		}
	};
};

export const actions: Actions = {
	save: async (event) => {
		requireSuperAdmin(event);

		const formData = await event.request.formData();
		const host = formData.get('host')?.toString().trim() || null;
		const portRaw = formData.get('port')?.toString().trim();
		const secure = formData.get('secure') === 'on';
		const user = formData.get('user')?.toString().trim() || null;
		const password = formData.get('password')?.toString();
		const from = formData.get('from')?.toString().trim() || null;

		let port: number | null = null;
		if (portRaw) {
			port = Number(portRaw);
			if (!Number.isInteger(port) || port <= 0) {
				return fail(400, { message: 'Port must be a positive whole number' });
			}
		}

		await upsertSmtpSettings({
			host,
			port,
			secure,
			user,
			// An empty password field means "leave it as-is" — never silently wipe a saved
			// credential just because the admin re-saved the form without retyping it.
			pass: password ? password : undefined,
			from
		});

		return { success: true };
	},

	test: async (event) => {
		const user = requireSuperAdmin(event);

		const formData = await event.request.formData();
		const to = formData.get('testEmail')?.toString().trim() || user.email;

		try {
			const { delivered } = await sendEmail({
				to,
				subject: 'Test email from metadose-assets',
				html: '<p>This is a test email — if you received it, SMTP delivery is working.</p>'
			});
			if (!delivered) {
				return fail(400, { tested: true, message: 'SMTP is not configured — set a host below and save first' });
			}
		} catch (err) {
			return fail(400, { tested: true, message: err instanceof Error ? err.message : 'Could not send test email' });
		}

		return { success: true, tested: true, testEmail: to };
	}
};
