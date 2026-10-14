import { json } from '@sveltejs/kit';
import { requireOrgPermission, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { createLocation } from '$lib/server/services/locations';
import type { RequestHandler } from './$types';

/**
 * Lets anyone who can check things out add a new location inline from a checkout form's
 * searchable dropdown — mirrors `/api/lookup-values` for manufacturer/category/condition, same
 * reasoning: "there's no Finance Dept yet, add it" is a normal part of checking something out,
 * not schema management (which is what `/manage/locations` requires `record:['checkout']` for too).
 */
export const POST: RequestHandler = async (event) => {
	const user = requireUser(event);
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
	await requireOrgPermission(event, orgMembership, { record: ['checkout'] });

	const body = await event.request.json().catch(() => null);
	const name = typeof body?.name === 'string' ? body.name.trim() : '';
	if (!name) return json({ message: 'Name is required' }, { status: 400 });

	try {
		const created = await createLocation({ organizationId: orgMembership.organization.id, name, actorUserId: user.id });
		return json({ created });
	} catch (err) {
		return json({ message: err instanceof Error ? err.message : 'Could not add location' }, { status: 400 });
	}
};
