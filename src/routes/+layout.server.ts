import { getInstanceSettings } from '$lib/server/services/settings';
import type { LayoutServerLoad } from './$types';

/**
 * Runs for every route in the app — just the one instance-wide display setting every page may
 * want (see $lib/dateFormat.ts), so pages don't each need their own lookup.
 */
export const load: LayoutServerLoad = async () => {
	const settings = await getInstanceSettings();
	return { timezone: settings?.timezone ?? null };
};
