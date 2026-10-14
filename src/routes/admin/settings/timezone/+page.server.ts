import { fail } from '@sveltejs/kit';
import { requireSuperAdmin } from '$lib/server/authz';
import { getInstanceSettings, upsertTimezone } from '$lib/server/services/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireSuperAdmin(event);
	const settings = await getInstanceSettings();

	return {
		timezone: settings?.timezone ?? '',
		// The full canonical IANA zone list, generated at runtime rather than hand-maintained.
		zones: Intl.supportedValuesOf('timeZone')
	};
};

export const actions: Actions = {
	save: async (event) => {
		requireSuperAdmin(event);

		const formData = await event.request.formData();
		const timezone = formData.get('timezone')?.toString().trim() || null;

		if (timezone) {
			try {
				// Throws for an invalid/unknown zone name — the cheapest way to validate one.
				new Intl.DateTimeFormat(undefined, { timeZone: timezone });
			} catch {
				return fail(400, { message: 'That timezone is not recognized' });
			}
		}

		await upsertTimezone(timezone);
		return { success: true };
	}
};
