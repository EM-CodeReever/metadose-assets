/**
 * Significant, human-readable changes per release — shown in the instance admin console's
 * "See version history" modal. Add a new entry here (newest first) whenever `package.json`'s
 * version is bumped for a release; this file is the source of truth for what shipped, not meant
 * to list every commit.
 */
export interface ChangelogEntry {
	version: string;
	date: string;
	changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '1.1.0',
		date: '2026-11-02',
		changes: [
			'Added a EULA / agreement workflow: object types can require a EULA (now a rich-text field with bold, italics, lists, etc.) that the recipient must opt into at checkout, confirmed by typing their full name.',
			'Accepting a EULA now generates a permanent, downloadable/printable PDF of exactly what was agreed to, tied to that specific checkout — if an item is checked in and reassigned to someone else, both people\'s signed agreements are kept on record separately.',
			'Restricted an item\'s Activity history and Attachments to owner/admin/manager roles (and instance-admin support access) — regular members and viewers no longer see them, though an assignee can still download their own signed EULA PDF.',
			'Added per-asset maintenance scheduling: object types can opt in (off by default), records can be given a recurring "check every N days" interval, and the system emails the assignee plus the organization\'s owners/admins/managers once an item becomes due, then daily until it\'s checked.',
			'Added a "Perform maintenance check" action with a mandatory note (and an optional condition update) that\'s permanently logged on the record, and a "Remove schedule" action for retired/disposed items.',
			'Fixed changing a record\'s maintenance interval not recalculating its next due date.',
			'Fixed the object type settings page: checkboxes and the Save button no longer crowd each other, Save is now right-aligned, and saving twice in a row no longer clears the form\'s fields.',
			'Fixed misaligned buttons on the maintenance schedule controls.'
		]
	},
	{
		version: '1.0.3',
		date: '2026-10-21',
		changes: [
			'Lifted the 100-person-per-organization cap that better-auth silently applied by default — organizations can now grow as large as your infrastructure allows, including via large LDAP/CSV bulk imports.',
			'Instance admin Users page: fixed the header description text and "Bulk import" button crowding each other at narrower widths, and added pagination to the users table.',
			'Organization detail page (instance admin side): moved "Add member" above the members list, replaced the single-user dropdown with a searchable multi-select (checkboxes, chips) for adding several members at once, and added pagination to the members table.',
			'Added pagination to the organization-side Users page as well.',
			'LDAP sync page: moved the "Search LDAP" button onto its own row instead of crowding the group-filter checkboxes.'
		]
	},
	{
		version: '1.0.2',
		date: '2026-10-20',
		changes: [
			'Fixed a build-time CSS warning (and the underlying ordering bug): the brand kit\'s Google Fonts import was nested inside an imported file, which landed it after other rules once bundled — moved to the top of the app\'s actual stylesheet entry point, where @import rules are required to be.'
		]
	},
	{
		version: '1.0.1',
		date: '2026-10-16',
		changes: [
			'Added this version footer and "See version history" modal to the instance admin console.',
			'Fixed emailVerified never being set on any account, local or LDAP-synced — every user was permanently stuck with an unresolvable "email not verified" badge since this app has no email-verification flow to ever clear it. New accounts are now created already verified, and existing accounts were backfilled.'
		]
	},
	{
		version: '1.0.0',
		date: '2026-10-16',
		changes: [
			'First stable release.',
			'Asset, accessory, consumable and component tracking, plus custom object types with configurable individually-tracked vs. bulk-by-quantity behavior.',
			'Organizations with role-based access (owner/admin/manager/viewer/member), checkout/check-in workflows, member item requests with approval, and per-unit condition tracking on check-in.',
			'Reports, CSV import/export, barcode/QR scanning, and label printing.',
			'Instance administration: organizations, users (including bulk actions and CSV/LDAP import), LDAP directory sync with group support, SMTP settings with editable email templates, instance-wide timezone.',
			'Full activity logging, Docker-based deployment with an interactive setup script, and a branded, theme-aware UI with in-app documentation.'
		]
	}
];
