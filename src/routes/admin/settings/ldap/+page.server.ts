import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireSuperAdmin } from '$lib/server/authz';
import { getInstanceSettings, upsertLdapSettings } from '$lib/server/services/settings';
import { getLdapConfig, searchLdapUsers, testLdapConnection } from '$lib/server/services/ldap';
import { importUsers, MAX_IMPORT_ROWS } from '$lib/server/services/userImport';
import type { Actions, PageServerLoad } from './$types';

const ORG_ROLES = ['owner', 'admin', 'manager', 'viewer', 'member'] as const;

export const load: PageServerLoad = async (event) => {
	requireSuperAdmin(event);
	const [settings, organizations] = await Promise.all([
		getInstanceSettings(),
		db.query.organization.findMany({ orderBy: (o, { asc }) => asc(o.name) })
	]);

	return {
		organizations,
		ldap: {
			enabled: settings?.ldapEnabled ?? false,
			url: settings?.ldapUrl ?? '',
			bindDn: settings?.ldapBindDn ?? '',
			hasBindPassword: !!settings?.ldapBindPassword,
			searchBase: settings?.ldapSearchBase ?? '',
			userFilter: settings?.ldapUserFilter ?? '(objectClass=person)',
			emailAttribute: settings?.ldapEmailAttribute ?? 'mail',
			nameAttribute: settings?.ldapNameAttribute ?? 'cn',
			defaultOrganizationId: settings?.ldapDefaultOrganizationId ?? '',
			defaultRole: settings?.ldapDefaultRole ?? ''
		}
	};
};

export const actions: Actions = {
	save: async (event) => {
		requireSuperAdmin(event);

		const formData = await event.request.formData();
		const defaultRoleRaw = formData.get('defaultRole')?.toString();
		const defaultRole: string | null = (ORG_ROLES as readonly string[]).includes(defaultRoleRaw ?? '')
			? (defaultRoleRaw as string)
			: null;
		const bindPassword = formData.get('bindPassword')?.toString();

		await upsertLdapSettings({
			enabled: formData.get('enabled') === 'on',
			url: formData.get('url')?.toString().trim() || null,
			bindDn: formData.get('bindDn')?.toString().trim() || null,
			bindPassword: bindPassword ? bindPassword : undefined,
			searchBase: formData.get('searchBase')?.toString().trim() || null,
			userFilter: formData.get('userFilter')?.toString().trim() || null,
			emailAttribute: formData.get('emailAttribute')?.toString().trim() || null,
			nameAttribute: formData.get('nameAttribute')?.toString().trim() || null,
			defaultOrganizationId: formData.get('defaultOrganizationId')?.toString() || null,
			defaultRole
		});

		return { success: true };
	},

	test: async (event) => {
		requireSuperAdmin(event);

		try {
			const config = await getLdapConfig();
			await testLdapConnection(config);
		} catch (err) {
			return fail(400, { tested: true, message: err instanceof Error ? err.message : 'Could not connect' });
		}

		return { success: true, tested: true };
	},

	sync: async (event) => {
		const actor = requireSuperAdmin(event);

		const formData = await event.request.formData();
		const organizationId = formData.get('organizationId')?.toString() || undefined;
		const roleRaw = formData.get('role')?.toString();
		const role = (ORG_ROLES as readonly string[]).includes(roleRaw ?? '') ? (roleRaw as (typeof ORG_ROLES)[number]) : undefined;

		let entries: { name: string; email: string }[];
		try {
			const config = await getLdapConfig();
			entries = await searchLdapUsers(config);
		} catch (err) {
			return fail(400, { synced: true, message: err instanceof Error ? err.message : 'Could not search LDAP' });
		}

		if (entries.length === 0) return fail(400, { synced: true, message: 'LDAP search returned no users' });
		if (entries.length > MAX_IMPORT_ROWS) {
			return fail(400, { synced: true, message: `LDAP search returned more than ${MAX_IMPORT_ROWS} users — narrow the filter` });
		}

		const { created, failed, results } = await importUsers({
			rows: entries,
			organizationId,
			role: organizationId ? role : undefined,
			authSource: 'ldap',
			requestHeaders: event.request.headers,
			actorUserId: actor.id
		});

		return { success: true, synced: true, created, failed, errors: results.filter((r) => !r.success) };
	}
};
