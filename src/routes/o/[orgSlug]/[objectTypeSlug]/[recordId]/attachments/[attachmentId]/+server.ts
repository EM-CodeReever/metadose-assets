import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser, resolveOrgMembership } from '$lib/server/authz';
import { db } from '$lib/server/db';
import { checkout as checkoutTable } from '$lib/server/db/schema';
import { getAttachment } from '$lib/server/services/attachments';
import { getStorage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

const AUDIT_VISIBLE_ROLES = ['owner', 'admin', 'manager'];

// owner/admin/manager can download any attachment on a record they can see, same as before.
// member/viewer have no general access to attachments — the only thing they can reach here is
// their own EULA acceptance PDF (the one checkout-self-service case), never anyone else's file.
export const GET: RequestHandler = async (event) => {
	const user = requireUser(event);
	const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);

	const file = await getAttachment(orgMembership.organization.id, event.params.attachmentId);
	if (!file || file.recordId !== event.params.recordId) throw error(404, 'Attachment not found');

	const role = orgMembership.membership?.role;
	const canViewAll = orgMembership.isSuperAdminAccess || (role && AUDIT_VISIBLE_ROLES.includes(role));

	if (!canViewAll) {
		const isOwnEulaRecord =
			!!file.sourceCheckoutId &&
			!!(await db.query.checkout.findFirst({
				where: eq(checkoutTable.id, file.sourceCheckoutId)
			}).then((c) => c?.assignedToUserId === user.id));
		if (!isOwnEulaRecord) throw error(403, "You don't have permission to view this attachment");
	}

	const stream = await getStorage().getReadStream(file.storageKey);

	return new Response(stream, {
		headers: {
			'Content-Type': file.mimeType,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(file.fileName)}"`,
			'Content-Length': String(file.sizeBytes)
		}
	});
};
