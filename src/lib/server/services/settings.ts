import { db } from '$lib/server/db';
import { instanceSettings, INSTANCE_SETTINGS_ID } from '$lib/server/db/settings.schema';
import { eq } from 'drizzle-orm';

export async function getInstanceSettings() {
	return db.query.instanceSettings.findFirst({
		where: eq(instanceSettings.id, INSTANCE_SETTINGS_ID)
	});
}

export interface SmtpSettingsInput {
	host: string | null;
	port: number | null;
	secure: boolean;
	user: string | null;
	/** Omit (undefined) to keep the existing stored password unchanged — e.g. an untouched field. */
	pass?: string | null;
	from: string | null;
}

export async function upsertSmtpSettings(params: SmtpSettingsInput): Promise<void> {
	const existing = await getInstanceSettings();

	const values = {
		smtpHost: params.host,
		smtpPort: params.port,
		smtpSecure: params.secure,
		smtpUser: params.user,
		smtpFrom: params.from,
		...(params.pass !== undefined ? { smtpPass: params.pass } : {})
	};

	if (existing) {
		await db.update(instanceSettings).set(values).where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID));
	} else {
		await db.insert(instanceSettings).values({ id: INSTANCE_SETTINGS_ID, ...values });
	}
}

/** `null` clears the override, going back to each viewer's own browser/OS timezone. */
export async function upsertTimezone(timezone: string | null): Promise<void> {
	const existing = await getInstanceSettings();

	if (existing) {
		await db.update(instanceSettings).set({ timezone }).where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID));
	} else {
		await db.insert(instanceSettings).values({ id: INSTANCE_SETTINGS_ID, timezone });
	}
}

export interface LdapSettingsInput {
	enabled: boolean;
	url: string | null;
	bindDn: string | null;
	/** Omit (undefined) to keep the existing stored bind password unchanged. */
	bindPassword?: string | null;
	searchBase: string | null;
	userFilter: string | null;
	emailAttribute: string | null;
	nameAttribute: string | null;
	defaultOrganizationId: string | null;
	defaultRole: string | null;
}

export async function upsertLdapSettings(params: LdapSettingsInput): Promise<void> {
	const existing = await getInstanceSettings();

	const values = {
		ldapEnabled: params.enabled,
		ldapUrl: params.url,
		ldapBindDn: params.bindDn,
		ldapSearchBase: params.searchBase,
		ldapUserFilter: params.userFilter,
		ldapEmailAttribute: params.emailAttribute,
		ldapNameAttribute: params.nameAttribute,
		ldapDefaultOrganizationId: params.defaultOrganizationId,
		ldapDefaultRole: params.defaultRole,
		...(params.bindPassword !== undefined ? { ldapBindPassword: params.bindPassword } : {})
	};

	if (existing) {
		await db.update(instanceSettings).set(values).where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID));
	} else {
		await db.insert(instanceSettings).values({ id: INSTANCE_SETTINGS_ID, ...values });
	}
}
