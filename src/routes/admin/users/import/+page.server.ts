import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organization as organizationTable } from '$lib/server/db/schema';
import { requireSuperAdmin } from '$lib/server/authz';
import { importUsers, MAX_IMPORT_ROWS } from '$lib/server/services/userImport';
import type { Actions, PageServerLoad } from './$types';

const ORG_ROLES = ['owner', 'admin', 'manager', 'viewer', 'member'] as const;

export const load: PageServerLoad = async (event) => {
	requireSuperAdmin(event);
	const organizations = await db.query.organization.findMany({ orderBy: (o, { asc }) => asc(o.name) });
	return { organizations };
};

export const actions: Actions = {
	import: async (event) => {
		const actor = requireSuperAdmin(event);

		const formData = await event.request.formData();
		const organizationId = formData.get('organizationId')?.toString() || undefined;
		const roleRaw = formData.get('role')?.toString();
		const role = (ORG_ROLES as readonly string[]).includes(roleRaw ?? '') ? (roleRaw as (typeof ORG_ROLES)[number]) : undefined;

		let rows: { name: string; email: string }[];
		try {
			rows = JSON.parse(formData.get('rows')?.toString() ?? '[]');
		} catch {
			return fail(400, { message: 'Could not read the uploaded rows' });
		}
		if (rows.length === 0) return fail(400, { message: 'No rows to import' });
		if (rows.length > MAX_IMPORT_ROWS) return fail(400, { message: `A single import is capped at ${MAX_IMPORT_ROWS} rows` });

		if (organizationId) {
			const org = await db.query.organization.findFirst({ where: eq(organizationTable.id, organizationId) });
			if (!org) return fail(400, { message: 'Selected organization not found' });
		}

		const { results, created, failed } = await importUsers({
			rows,
			organizationId,
			role: organizationId ? role : undefined,
			requestHeaders: event.request.headers,
			actorUserId: actor.id
		});

		return { success: true, created, failed, errors: results.filter((r) => !r.success) };
	}
};
