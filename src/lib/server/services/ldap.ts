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
	/** Optional extra sync sources — group DNs configured on the LDAP settings page. */
	groupDns: string[];
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
		nameAttribute: settings.ldapNameAttribute || 'cn',
		groupDns: parseGroupDns(settings.ldapGroupDns)
	};
}

/** One DN per line; blank lines ignored. Shared by the settings load and the save action. */
export function parseGroupDns(raw: string | null | undefined): string[] {
	return (raw ?? '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

function firstValue(value: string | string[] | Buffer | Buffer[] | undefined): string {
	if (Array.isArray(value)) return firstValue(value[0]);
	if (Buffer.isBuffer(value)) return value.toString('utf8');
	return value ?? '';
}

/** Normalizes a possibly-multi-valued attribute (e.g. a group's `member` list) to a string array. */
function allValues(value: string | string[] | Buffer | Buffer[] | undefined): string[] {
	if (value === undefined) return [];
	const arr = Array.isArray(value) ? value : [value];
	return arr.map((v) => (Buffer.isBuffer(v) ? v.toString('utf8') : v)).filter(Boolean);
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

/**
 * Syncing from a group instead of (or in addition to) the OU/filter above. Reads the group
 * entry's own member list rather than relying on an AD-only `memberOf` overlay, so this works
 * against plain OpenLDAP groups too: one lookup for the group's `member`/`uniqueMember` DNs,
 * then one `scope: 'base'` lookup per member DN to read its name/email attributes.
 */
export async function searchLdapUsersByGroup(config: LdapConfig, groupDn: string): Promise<{ name: string; email: string }[]> {
	const client = new Client({ url: config.url });
	try {
		await client.bind(config.bindDn, config.bindPassword);

		const { searchEntries: groupEntries } = await client.search(groupDn, {
			scope: 'base',
			attributes: ['member', 'uniqueMember']
		});
		const group = groupEntries[0];
		if (!group) return [];

		const memberDns = [
			...allValues(group.member as string | string[] | undefined),
			...allValues(group.uniqueMember as string | string[] | undefined)
		];

		const users: { name: string; email: string }[] = [];
		for (const memberDn of memberDns) {
			try {
				const { searchEntries } = await client.search(memberDn, {
					scope: 'base',
					attributes: [config.emailAttribute, config.nameAttribute]
				});
				const entry = searchEntries[0];
				if (!entry) continue;
				const name = firstValue(entry[config.nameAttribute] as string | string[] | undefined);
				const email = firstValue(entry[config.emailAttribute] as string | string[] | undefined).toLowerCase();
				if (name && email) users.push({ name, email });
			} catch {
				// A stale/unreadable member DN shouldn't abort the whole group sync.
			}
		}
		return users;
	} finally {
		await client.unbind().catch(() => {});
	}
}
