import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { attachment } from '$lib/server/db/schema';
import { getStorage } from '$lib/server/storage';
import { logActivity } from './activityLog';

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20MB

function sanitizeFileName(name: string): string {
	const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_');
	return cleaned.slice(-150) || 'file';
}

export async function listAttachments(organizationId: string, recordId: string) {
	return db.query.attachment.findMany({
		where: and(eq(attachment.organizationId, organizationId), eq(attachment.recordId, recordId)),
		with: { uploadedByUser: true },
		orderBy: (a, { desc }) => desc(a.createdAt)
	});
}

export async function getAttachment(organizationId: string, attachmentId: string) {
	return db.query.attachment.findFirst({
		where: and(eq(attachment.organizationId, organizationId), eq(attachment.id, attachmentId))
	});
}

export async function uploadAttachment(params: {
	organizationId: string;
	recordId: string;
	file: File;
	uploadedBy: string;
}): Promise<string> {
	if (params.file.size === 0) throw new Error('File is empty');
	if (params.file.size > MAX_ATTACHMENT_BYTES) throw new Error('File is too large (max 20MB)');

	const id = randomUUID();
	const storageKey = `${params.organizationId}/${params.recordId}/${id}-${sanitizeFileName(params.file.name)}`;
	const buffer = Buffer.from(await params.file.arrayBuffer());

	await getStorage().put(storageKey, buffer);

	await db.transaction(async (tx) => {
		await tx.insert(attachment).values({
			id,
			organizationId: params.organizationId,
			recordId: params.recordId,
			fileName: params.file.name,
			mimeType: params.file.type || 'application/octet-stream',
			sizeBytes: params.file.size,
			storageKey,
			uploadedBy: params.uploadedBy
		});
		await logActivity(tx, {
			organizationId: params.organizationId,
			recordId: params.recordId,
			actorUserId: params.uploadedBy,
			action: 'attachment.added',
			summary: params.file.name
		});
	});

	return id;
}

export async function deleteAttachment(organizationId: string, attachmentId: string, actorUserId: string) {
	const existing = await getAttachment(organizationId, attachmentId);
	if (!existing) return;

	await db.transaction(async (tx) => {
		await tx.delete(attachment).where(eq(attachment.id, attachmentId));
		await logActivity(tx, {
			organizationId,
			recordId: existing.recordId,
			actorUserId,
			action: 'attachment.removed',
			summary: existing.fileName
		});
	});

	await getStorage().delete(existing.storageKey);
}
