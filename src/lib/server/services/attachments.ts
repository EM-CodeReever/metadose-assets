import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
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

/** The EULA acceptance PDFs generated for a given set of checkouts — used to give a signer a
 *  self-service download link to their own signed copy even when their role can't see the
 *  record's general attachments list. Returned keyed by checkout id for easy lookup. */
export async function listEulaAttachmentsForCheckouts(
	organizationId: string,
	checkoutIds: string[]
): Promise<Map<string, { id: string; fileName: string }>> {
	if (checkoutIds.length === 0) return new Map();
	const rows = await db.query.attachment.findMany({
		where: and(eq(attachment.organizationId, organizationId), inArray(attachment.sourceCheckoutId, checkoutIds))
	});
	return new Map(rows.filter((r) => r.sourceCheckoutId).map((r) => [r.sourceCheckoutId!, { id: r.id, fileName: r.fileName }]));
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

/** Stores a server-generated file (currently just EULA acceptance PDFs) as a real attachment,
 *  bypassing `uploadAttachment`'s `File`-shaped wrapper since there's no browser upload involved —
 *  the storage backend's `put` already takes a `Buffer` directly. */
export async function storeGeneratedPdfAttachment(params: {
	organizationId: string;
	recordId: string;
	sourceCheckoutId: string;
	fileName: string;
	buffer: Buffer;
	uploadedBy: string;
	activitySummary: string;
}): Promise<string> {
	const id = randomUUID();
	const storageKey = `${params.organizationId}/${params.recordId}/${id}-${sanitizeFileName(params.fileName)}`;

	await getStorage().put(storageKey, params.buffer);

	await db.transaction(async (tx) => {
		await tx.insert(attachment).values({
			id,
			organizationId: params.organizationId,
			recordId: params.recordId,
			fileName: params.fileName,
			mimeType: 'application/pdf',
			sizeBytes: params.buffer.byteLength,
			storageKey,
			uploadedBy: params.uploadedBy,
			sourceCheckoutId: params.sourceCheckoutId
		});
		await logActivity(tx, {
			organizationId: params.organizationId,
			recordId: params.recordId,
			actorUserId: params.uploadedBy,
			action: 'checkout.eula_recorded',
			summary: params.activitySummary
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
