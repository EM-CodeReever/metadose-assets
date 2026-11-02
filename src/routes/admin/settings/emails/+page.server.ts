import { fail } from '@sveltejs/kit';
import { requireSuperAdmin } from '$lib/server/authz';
import { listEmailTemplates, resetEmailTemplate, upsertEmailTemplate, type EmailTemplateKey } from '$lib/server/services/emailTemplates';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireSuperAdmin(event);
	return { templates: await listEmailTemplates() };
};

export const actions: Actions = {
	save: async (event) => {
		requireSuperAdmin(event);
		const formData = await event.request.formData();
		const key = formData.get('key')?.toString() as EmailTemplateKey | undefined;
		const subject = formData.get('subject')?.toString().trim() ?? '';
		const html = formData.get('html')?.toString() ?? '';

		if (!key) return fail(400, { key: '', message: 'Missing template' });
		if (!subject || !html) return fail(400, { key, message: 'Subject and body are both required' });

		await upsertEmailTemplate(key, { subject, html });
		return { success: true, key, message: '', wasReset: false };
	},

	reset: async (event) => {
		requireSuperAdmin(event);
		const formData = await event.request.formData();
		const key = formData.get('key')?.toString() as EmailTemplateKey | undefined;
		if (!key) return fail(400, { key: '', message: 'Missing template' });

		await resetEmailTemplate(key);
		return { success: true, key, message: '', wasReset: true };
	}
};
