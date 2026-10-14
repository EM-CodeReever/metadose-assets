import { error } from '@sveltejs/kit';
import { resolveOrgMembership } from '$lib/server/authz';
import { getAttachment } from '$lib/server/services/attachments';
import { getStorage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// Not gated by a specific attachment permission beyond org membership — any role that
// can view the record (all of them, including viewer) can download its attachments.
export const GET: RequestHandler = async (event) => {
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);

	const file = await getAttachment(orgMembership.organization.id, event.params.attachmentId);
	if (!file || file.recordId !== event.params.recordId) throw error(404, 'Attachment not found');

	const stream = await getStorage().getReadStream(file.storageKey);

	return new Response(stream, {
		headers: {
			'Content-Type': file.mimeType,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(file.fileName)}"`,
			'Content-Length': String(file.sizeBytes)
		}
	});
};
