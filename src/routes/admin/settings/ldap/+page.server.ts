import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireSuperAdmin } from '$lib/server/authz';
import { getInstanceSettings, upsertLdapSettings } from '$lib/server/services/settings';
import { getLdapConfig, testLdapConnection } from '$lib/server/services/ldap';
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
			defaultRole: settings?.ldapDefaultRole ?? '',
			groupDns: settings?.ldapGroupDns ?? ''
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
			defaultRole,
			groupDns: formData.get('groupDns')?.toString().trim() || null
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
	}
};
