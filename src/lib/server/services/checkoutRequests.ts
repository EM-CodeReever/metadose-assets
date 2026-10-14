import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { checkoutRequest, record, user } from '$lib/server/db/schema';
import { logActivity } from './activityLog';
import { checkoutRecord, getAvailableQuantity, getCurrentCheckout } from './checkouts';

async function getRequestableRecord(organizationId: string, recordId: string) {
	const found = await db.query.record.findFirst({
		where: and(eq(record.organizationId, organizationId), eq(record.id, recordId), isNull(record.deletedAt)),
		with: { objectType: true }
	});
	if (!found) throw new Error('Record not found');
	// 'component' can never be requested regardless of the per-type toggle — it checks out into
	// an asset, not to a person, so there's no member-facing concept of "requesting" one.
	if (found.objectType.builtinKind === 'component') {
		throw new Error('This kind of record cannot be requested');
	}
	// A record's own requestableOverride (set/unset per-record on the detail page) wins when
	// present; null falls back to the object type's own default.
	const effectiveRequestable = found.requestableOverride ?? found.objectType.requestable;
	if (!effectiveRequestable) {
		throw new Error('Requesting is turned off for this record');
	}
	return found;
}

export async function createCheckoutRequest(
	organizationId: string,
	recordId: string,
	requestedByUserId: string,
	note?: string
): Promise<void> {
	const requester = await db.query.user.findFirst({ where: eq(user.id, requestedByUserId) });
	// Mirrors the same rule `checkoutRecord` enforces at approval time — reject up front so a
	// super-admin's request doesn't sit around as 'pending' only to fail when someone approves it.
	if (requester?.role === 'super_admin') {
		throw new Error('Instance admin accounts cannot request items');
	}

	const rec = await getRequestableRecord(organizationId, recordId);
	if (rec.status === 'archived') throw new Error('This record is archived and cannot be requested');

	const isQuantityBased = rec.objectType.builtinKind !== 'asset';
	if (isQuantityBased) {
		const totalQuantity = Number(rec.data.values.quantity) || 0;
		const available = await getAvailableQuantity(organizationId, rec.id, totalQuantity);
		if (available <= 0) throw new Error('None currently available to request');
	} else {
		const existing = await getCurrentCheckout(organizationId, rec.id);
		if (existing) throw new Error('This is already checked out');
	}

	const existingPending = await db.query.checkoutRequest.findFirst({
		where: and(
			eq(checkoutRequest.organizationId, organizationId),
			eq(checkoutRequest.recordId, recordId),
			eq(checkoutRequest.requestedByUserId, requestedByUserId),
			eq(checkoutRequest.status, 'pending')
		)
	});
	if (existingPending) throw new Error('You already have a pending request for this');

	await db.transaction(async (tx) => {
		await tx.insert(checkoutRequest).values({
			id: randomUUID(),
			organizationId,
			recordId,
			requestedByUserId,
			note: note || undefined
		});
		await logActivity(tx, {
			organizationId,
			recordId,
			actorUserId: requestedByUserId,
			action: 'record.requested'
		});
	});
}

export async function listMyCheckoutRequests(organizationId: string, userId: string) {
	return db.query.checkoutRequest.findMany({
		where: and(eq(checkoutRequest.organizationId, organizationId), eq(checkoutRequest.requestedByUserId, userId)),
		with: { record: { with: { objectType: true } } },
		orderBy: (r, { desc }) => desc(r.createdAt)
	});
}

export async function listPendingCheckoutRequests(organizationId: string) {
	return db.query.checkoutRequest.findMany({
		where: and(eq(checkoutRequest.organizationId, organizationId), eq(checkoutRequest.status, 'pending')),
		with: { record: { with: { objectType: true } }, requestedByUser: true },
		orderBy: (r, { asc }) => asc(r.createdAt)
	});
}

async function getPendingRequest(organizationId: string, requestId: string) {
	const found = await db.query.checkoutRequest.findFirst({
		where: and(
			eq(checkoutRequest.organizationId, organizationId),
			eq(checkoutRequest.id, requestId),
			eq(checkoutRequest.status, 'pending')
		)
	});
	if (!found) throw new Error('This request is no longer pending');
	return found;
}

export async function approveCheckoutRequest(
	organizationId: string,
	requestId: string,
	actorUserId: string,
	params: { assignedToLocationId?: string; quantity?: number; dueAt?: Date }
): Promise<void> {
	const request = await getPendingRequest(organizationId, requestId);

	await checkoutRecord({
		organizationId,
		recordId: request.recordId,
		assignedToType: 'user',
		assignedToUserId: request.requestedByUserId,
		assignedToLocationId: params.assignedToLocationId,
		quantity: params.quantity,
		dueAt: params.dueAt,
		checkedOutBy: actorUserId
	});

	// checkoutRecord doesn't return the row it inserted, so the just-created open checkout for
	// this exact record+user is looked up again to link it on the request — there can only be one
	// open checkout per (record, assignedToUserId) created in the instant above.
	const created = await getCurrentCheckout(organizationId, request.recordId);

	await db
		.update(checkoutRequest)
		.set({
			status: 'fulfilled',
			decidedBy: actorUserId,
			decidedAt: new Date(),
			fulfilledCheckoutId: created?.id
		})
		.where(eq(checkoutRequest.id, request.id));

	await logActivity(db, {
		organizationId,
		recordId: request.recordId,
		actorUserId,
		action: 'record.request_approved'
	});
}

export async function rejectCheckoutRequest(
	organizationId: string,
	requestId: string,
	actorUserId: string,
	decisionNote?: string
): Promise<void> {
	const request = await getPendingRequest(organizationId, requestId);

	await db.transaction(async (tx) => {
		await tx
			.update(checkoutRequest)
			.set({ status: 'rejected', decidedBy: actorUserId, decidedAt: new Date(), decisionNote: decisionNote || undefined })
			.where(eq(checkoutRequest.id, request.id));
		await logActivity(tx, {
			organizationId,
			recordId: request.recordId,
			actorUserId,
			action: 'record.request_rejected'
		});
	});
}

export async function cancelCheckoutRequest(organizationId: string, requestId: string, userId: string): Promise<void> {
	const request = await getPendingRequest(organizationId, requestId);
	if (request.requestedByUserId !== userId) throw new Error('This is not your request');

	await db.transaction(async (tx) => {
		await tx.update(checkoutRequest).set({ status: 'cancelled' }).where(eq(checkoutRequest.id, request.id));
		await logActivity(tx, {
			organizationId,
			recordId: request.recordId,
			actorUserId: userId,
			action: 'record.request_cancelled'
		});
	});
}
