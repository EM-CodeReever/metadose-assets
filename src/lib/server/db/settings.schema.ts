import { mysqlTable, varchar, int, boolean, timestamp } from 'drizzle-orm/mysql-core';
import { organization } from './auth.schema';

/**
 * Single-row table for instance-wide (not per-organization) configuration — currently just SMTP,
 * editable from the admin console instead of requiring a `.env` edit + restart. A fixed id keeps
 * "the one row" lookup trivial; env vars remain a fallback for anything left unset here (see
 * `$lib/server/email.ts`), so deployments that prefer pure env-based config keep working.
 */
export const instanceSettings = mysqlTable('instance_settings', {
	id: varchar('id', { length: 36 }).primaryKey(),
	smtpHost: varchar('smtp_host', { length: 255 }),
	smtpPort: int('smtp_port'),
	smtpSecure: boolean('smtp_secure').default(false).notNull(),
	smtpUser: varchar('smtp_user', { length: 255 }),
	smtpPass: varchar('smtp_pass', { length: 255 }),
	smtpFrom: varchar('smtp_from', { length: 255 }),

	ldapEnabled: boolean('ldap_enabled').default(false).notNull(),
	ldapUrl: varchar('ldap_url', { length: 500 }),
	ldapBindDn: varchar('ldap_bind_dn', { length: 500 }),
	ldapBindPassword: varchar('ldap_bind_password', { length: 255 }),
	ldapSearchBase: varchar('ldap_search_base', { length: 500 }),
	ldapUserFilter: varchar('ldap_user_filter', { length: 500 }).default('(objectClass=person)'),
	ldapEmailAttribute: varchar('ldap_email_attribute', { length: 100 }).default('mail'),
	ldapNameAttribute: varchar('ldap_name_attribute', { length: 100 }).default('cn'),
	// Where/what role LDAP-synced users land by default — set null if that org is ever deleted,
	// rather than failing the whole sync config.
	ldapDefaultOrganizationId: varchar('ldap_default_organization_id', { length: 36 }).references(
		() => organization.id,
		{ onDelete: 'set null' }
	),
	ldapDefaultRole: varchar('ldap_default_role', { length: 50 }),

	// IANA zone name (e.g. "America/Jamaica") used to render every date/time shown across the
	// app, instead of each viewer's own browser/OS timezone — keeps timestamps consistent for a
	// shared deployment. Null means "no override", falling back to the browser's local zone.
	timezone: varchar('timezone', { length: 100 }),

	updatedAt: timestamp('updated_at', { fsp: 3 })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const INSTANCE_SETTINGS_ID = 'singleton';
