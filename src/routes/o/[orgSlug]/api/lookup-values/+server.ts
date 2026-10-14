import { json } from '@sveltejs/kit';
import { requireOrgPermission, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { createLookupValue, LOOKUP_KINDS, type LookupKind } from '$lib/server/services/lookupValues';
import type { RequestHandler } from './$types';

/**
 * Lets anyone who can create/edit records add a new manufacturer/category/condition inline from
 * a record form's searchable dropdown — separate from the `/manage/*` pages (which require
 * `manage_fields`), since choosing "there's no Dell yet, add it" is a normal part of data entry,
 * not schema management.
 */
export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
	await requireOrgPermission(event, orgMembership, { record: ['create'] });

	const body = await event.request.json().catch(() => null);
	const kind = body?.kind;
	const name = typeof body?.name === 'string' ? body.name : '';

	if (!LOOKUP_KINDS.includes(kind as LookupKind)) {
		return json({ message: 'Invalid lookup kind' }, { status: 400 });
	}

	try {
		const created = await createLookupValue(orgMembership.organization.id, kind as LookupKind, name, false, user.id);
		return json({ created });
	} catch (err) {
		return json({ message: err instanceof Error ? err.message : 'Could not add value' }, { status: 400 });
	}
};
