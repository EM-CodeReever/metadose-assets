import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireSuperAdmin } from '$lib/server/authz';
import { getLdapConfig, searchLdapUsers, searchLdapUsersByGroup } from '$lib/server/services/ldap';
import { importUsers, MAX_IMPORT_ROWS } from '$lib/server/services/userImport';
import type { Actions, PageServerLoad } from './$types';

const ORG_ROLES = ['owner', 'admin', 'manager', 'viewer', 'member'] as const;

export const load: PageServerLoad = async (event) => {
	requireSuperAdmin(event);

	let configured = true;
	let configError = '';
	let groupDns: string[] = [];
	try {
		const config = await getLdapConfig();
		groupDns = config.groupDns;
	} catch (err) {
		configured = false;
		configError = err instanceof Error ? err.message : 'LDAP is not configured';
	}

	const organizations = await db.query.organization.findMany({ orderBy: (o, { asc }) => asc(o.name) });

	return { configured, configError, groupDns, organizations };
};

export const actions: Actions = {
	search: async (event) => {
		requireSuperAdmin(event);
		const formData = await event.request.formData();
		const useFilter = formData.get('useFilter') === 'on';
		const selectedGroups = formData.getAll('groups').map((g) => g.toString());

		let config;
		try {
			config = await getLdapConfig();
		} catch (err) {
			return fail(400, { searched: true, message: err instanceof Error ? err.message : 'LDAP is not configured' });
		}

		if (!useFilter && selectedGroups.length === 0) {
			return fail(400, { searched: true, message: 'Pick at least one source — the OU filter or a group' });
		}

		const merged = new Map<string, { name: string; email: string }>();
		try {
			if (useFilter) {
				for (const u of await searchLdapUsers(config)) merged.set(u.email, u);
			}
			for (const groupDn of selectedGroups) {
				for (const u of await searchLdapUsersByGroup(config, groupDn)) merged.set(u.email, u);
			}
		} catch (err) {
			return fail(400, { searched: true, message: err instanceof Error ? err.message : 'Could not search LDAP' });
		}

		const candidates = [...merged.values()];
		if (candidates.length === 0) return fail(400, { searched: true, message: 'No users matched' });
		if (candidates.length > MAX_IMPORT_ROWS) {
			return fail(400, { searched: true, message: `Matched more than ${MAX_IMPORT_ROWS} users — narrow the filter/groups` });
		}

		return { searched: true, success: true, candidates };
	},

	confirmSync: async (event) => {
		const actor = requireSuperAdmin(event);
		const formData = await event.request.formData();

		let selected: { name: string; email: string }[];
		try {
			selected = JSON.parse(formData.get('selectedCandidates')?.toString() ?? '[]');
		} catch {
			return fail(400, { synced: true, message: 'Invalid selection' });
		}
		if (!Array.isArray(selected) || selected.length === 0) {
			return fail(400, { synced: true, message: 'Select at least one user to sync' });
		}

		const organizationId = formData.get('organizationId')?.toString() || undefined;
		const roleRaw = formData.get('role')?.toString();
		const role = (ORG_ROLES as readonly string[]).includes(roleRaw ?? '') ? (roleRaw as (typeof ORG_ROLES)[number]) : undefined;
		const sendWelcomeEmail = formData.get('sendWelcomeEmail') === 'on';

		const { created, failed, results } = await importUsers({
			rows: selected,
			organizationId,
			role: organizationId ? role : undefined,
			authSource: 'ldap',
			sendWelcomeEmail,
			requestHeaders: event.request.headers,
			actorUserId: actor.id
		});

		return { success: true, synced: true, created, failed, errors: results.filter((r) => !r.success) };
	}
};
