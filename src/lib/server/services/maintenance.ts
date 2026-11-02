import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { record, maintenanceCheck, objectType } from '$lib/server/db/schema';
import { logActivity } from './activityLog';
import { updateRecord, getRecord } from './records';

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(from: Date, days: number): Date {
	return new Date(from.getTime() + days * DAY_MS);
}

function startOfToday(): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Configures (or removes) a record's recurring maintenance interval. The due date is always
 *  recomputed from the last maintenance check (or from today, if it's never been checked) plus
 *  the new interval — so changing the interval actually moves the due date, rather than leaving
 *  whatever was computed under the old interval in place. Removing the schedule (null) wipes the
 *  due date/notified state too, since there's nothing to be "due" or "notified" about anymore —
 *  useful once an asset is retired or disposed. */
export async function setMaintenanceSchedule(
	organizationId: string,
	recordId: string,
	intervalDays: number | null,
	actorUserId: string
): Promise<void> {
	const existing = await getRecord(organizationId, recordId);
	if (!existing) throw new Error('Record not found');
	if (intervalDays !== null && intervalDays <= 0) throw new Error('Interval must be at least 1 day');

	await db.transaction(async (tx) => {
		await tx
			.update(record)
			.set({
				maintenanceIntervalDays: intervalDays,
				maintenanceDueAt:
					intervalDays === null ? null : addDays(existing.lastMaintenanceAt ?? new Date(), intervalDays),
				maintenanceLastNotifiedAt: null
			})
			.where(and(eq(record.id, recordId), eq(record.organizationId, organizationId)));
		await logActivity(tx, {
			organizationId,
			recordId,
			actorUserId,
			action: 'record.maintenance_scheduled',
			summary:
				intervalDays === null
					? 'Maintenance schedule removed'
					: `Maintenance scheduled every ${intervalDays} day${intervalDays === 1 ? '' : 's'}`
		});
	});
}

/** Performs a maintenance check: logs it permanently, optionally updates the record's condition,
 *  and advances the next due date. The note is mandatory — even "all good, no issues found" has to
 *  be written down, not just implied by clicking the button. */
export async function performMaintenanceCheck(params: {
	organizationId: string;
	recordId: string;
	performedBy: string;
	note: string;
	conditionId?: string;
	/** The object type's condition field_definition key (whatever the admin named it) — required
	 *  alongside `conditionId` to actually write the change; resolved by the caller, which already
	 *  has the object type's field list loaded. */
	conditionFieldKey?: string;
}): Promise<void> {
	const note = params.note.trim();
	if (!note) throw new Error('A maintenance note is required');

	const existing = await getRecord(params.organizationId, params.recordId);
	if (!existing) throw new Error('Record not found');

	if (params.conditionId && params.conditionFieldKey) {
		await updateRecord({
			organizationId: params.organizationId,
			objectTypeId: existing.objectTypeId,
			recordId: params.recordId,
			values: { ...existing.data.values, [params.conditionFieldKey]: params.conditionId },
			updatedBy: params.performedBy
		});
	}

	const performedAt = new Date();
	const nextDueAt = existing.maintenanceIntervalDays ? addDays(performedAt, existing.maintenanceIntervalDays) : null;

	await db.transaction(async (tx) => {
		await tx.insert(maintenanceCheck).values({
			id: randomUUID(),
			organizationId: params.organizationId,
			recordId: params.recordId,
			performedBy: params.performedBy,
			performedAt,
			conditionId: params.conditionId,
			note
		});
		await tx
			.update(record)
			.set({ lastMaintenanceAt: performedAt, maintenanceDueAt: nextDueAt, maintenanceLastNotifiedAt: null })
			.where(and(eq(record.id, params.recordId), eq(record.organizationId, params.organizationId)));
		await logActivity(tx, {
			organizationId: params.organizationId,
			recordId: params.recordId,
			actorUserId: params.performedBy,
			action: 'record.maintenance_checked',
			summary: note
		});
	});
}

export async function listMaintenanceChecks(organizationId: string, recordId: string) {
	return db.query.maintenanceCheck.findMany({
		where: and(eq(maintenanceCheck.organizationId, organizationId), eq(maintenanceCheck.recordId, recordId)),
		with: { performedByUser: true, condition: true },
		orderBy: (c, { desc }) => desc(c.performedAt)
	});
}

/** Records that are due for maintenance and haven't already been notified about it today — the
 *  dedupe key behind the reminder sweep's "once a day while overdue" cadence. Cross-org by design,
 *  since the sweep itself isn't scoped to one organization. */
export async function findDueMaintenanceRecords() {
	const now = new Date();
	const today = startOfToday();

	return db.query.record.findMany({
		where: and(
			lte(record.maintenanceDueAt, now),
			isNull(record.deletedAt),
			or(isNull(record.maintenanceLastNotifiedAt), lte(record.maintenanceLastNotifiedAt, today))
		),
		with: { objectType: true }
	}).then((rows) => rows.filter((r) => r.objectType.maintenanceEnabled));
}

export async function markMaintenanceNotified(recordId: string): Promise<void> {
	await db.update(record).set({ maintenanceLastNotifiedAt: new Date() }).where(eq(record.id, recordId));
}
