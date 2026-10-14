import { error } from '@sveltejs/kit';
import { resolveOrgMembership } from '$lib/server/authz';
import { getObjectTypeBySlug } from '$lib/server/services/objectTypes';
import { getRecord } from '$lib/server/services/records';
import type { PageServerLoad } from './$types';

// Doesn't use `event.parent()`: this route resets its layout (`+page@.svelte`, to escape the
// org sidebar for a clean print view), and SvelteKit's generated parent-data types go stale
// across a layout reset even though the ancestor `load` functions still run.
export const load: PageServerLoad = async (event) => {
	const { organization } = await resolveOrgMembership(event, event.params.orgSlug);
	const objectType = await getObjectTypeBySlug(organization.id, event.params.objectTypeSlug);
	if (!objectType) throw error(404, 'Object type not found');

	const record = await getRecord(organization.id, event.params.recordId);
	if (!record || record.objectTypeId !== objectType.id) throw error(404, 'Record not found');

	return { organization, objectType, record };
};
