import { Client, escapeFilter } from 'ldapts';
import { getInstanceSettings } from './settings';

export interface LdapConfig {
	url: string;
	bindDn: string;
	bindPassword: string;
	searchBase: string;
	userFilter: string;
	emailAttribute: string;
	nameAttribute: string;
}

/** Reads the saved LDAP config, throwing a friendly error if it isn't enabled/fully set up yet. */
export async function getLdapConfig(): Promise<LdapConfig> {
	const settings = await getInstanceSettings();
	if (!settings?.ldapEnabled) {
		throw new Error('LDAP is not enabled');
	}
	if (!settings.ldapUrl || !settings.ldapBindDn || !settings.ldapBindPassword || !settings.ldapSearchBase) {
		throw new Error('LDAP is not fully configured — set a server URL, bind DN/password, and search base first');
	}
	return {
		url: settings.ldapUrl,
		bindDn: settings.ldapBindDn,
		bindPassword: settings.ldapBindPassword,
		searchBase: settings.ldapSearchBase,
		userFilter: settings.ldapUserFilter || '(objectClass=person)',
		emailAttribute: settings.ldapEmailAttribute || 'mail',
		nameAttribute: settings.ldapNameAttribute || 'cn'
	};
}

function firstValue(value: string | string[] | Buffer | Buffer[] | undefined): string {
	if (Array.isArray(value)) return firstValue(value[0]);
	if (Buffer.isBuffer(value)) return value.toString('utf8');
	return value ?? '';
}

/** Binds and immediately unbinds — just confirms the server/credentials work. */
export async function testLdapConnection(config: LdapConfig): Promise<void> {
	const client = new Client({ url: config.url });
	try {
		await client.bind(config.bindDn, config.bindPassword);
	} finally {
		await client.unbind().catch(() => {});
	}
}

/**
 * The standard "search then bind" LDAP auth pattern: bind as the service account, find the
 * entry matching this email, then attempt a second bind AS that entry's own DN with the
 * password the user just typed. Success there is the actual credential check — the directory
 * stays the single source of truth for an `authSource: 'ldap'` account.
 */
export async function verifyLdapCredentials(config: LdapConfig, email: string, password: string): Promise<boolean> {
	if (!password) return false;

	const serviceClient = new Client({ url: config.url });
	let dn: string | undefined;
	try {
		await serviceClient.bind(config.bindDn, config.bindPassword);
		// Only `email` is untrusted input here — config.userFilter/emailAttribute are admin-set
		// LDAP syntax and attribute names, which must stay unescaped to mean anything.
		const { searchEntries } = await serviceClient.search(config.searchBase, {
			scope: 'sub',
			filter: `(&${config.userFilter}(${config.emailAttribute}=${escapeFilter`${email}`}))`,
			attributes: ['dn']
		});
		dn = searchEntries[0]?.dn;
	} catch {
		return false;
	} finally {
		await serviceClient.unbind().catch(() => {});
	}
	if (!dn) return false;

	const userClient = new Client({ url: config.url });
	try {
		await userClient.bind(dn, password);
		return true;
	} catch {
		return false;
	} finally {
		await userClient.unbind().catch(() => {});
	}
}

export async function searchLdapUsers(config: LdapConfig): Promise<{ name: string; email: string }[]> {
	const client = new Client({ url: config.url });
	try {
		await client.bind(config.bindDn, config.bindPassword);
		const { searchEntries } = await client.search(config.searchBase, {
			scope: 'sub',
			filter: config.userFilter,
			attributes: [config.emailAttribute, config.nameAttribute]
		});

		return searchEntries
			.map((entry) => ({
				name: firstValue(entry[config.nameAttribute] as string | string[] | undefined),
				email: firstValue(entry[config.emailAttribute] as string | string[] | undefined).toLowerCase()
			}))
			.filter((u) => u.name && u.email);
	} finally {
		await client.unbind().catch(() => {});
	}
}
