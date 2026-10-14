/**
 * Formats a date, honoring the instance-configured timezone override (see
 * admin/settings/timezone) when one is set — otherwise falls back to the viewer's own
 * browser/OS timezone, exactly like a plain `toLocaleString()` call.
 */
export function formatDateTime(value: string | Date | null | undefined, timezone?: string | null): string {
	if (!value) return '—';
	const date = new Date(value);
	if (!timezone) return date.toLocaleString();

	try {
		return date.toLocaleString(undefined, { timeZone: timezone });
	} catch {
		// Invalid/unsupported zone name stored somehow — degrade instead of throwing.
		return date.toLocaleString();
	}
}
