import { error } from '@sveltejs/kit';
import { resolveOrgMembership } from '$lib/server/authz';
import { getRecord } from '$lib/server/services/records';
import { getStorage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// Served inline (not force-downloaded) so it can be used directly as an <img src>. Gated by
// org membership only, same as the record page itself — any role that can view the record can
// see its cover image.
export const GET: RequestHandler = async (event) => {
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);

	const rec = await getRecord(orgMembership.organization.id, event.params.recordId);
	if (!rec?.imageStorageKey) throw error(404, 'No image');

	const stream = await getStorage().getReadStream(rec.imageStorageKey);

	return new Response(stream, {
		headers: {
			'Content-Type': rec.imageMimeType ?? 'application/octet-stream',
			'Content-Disposition': 'inline',
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
