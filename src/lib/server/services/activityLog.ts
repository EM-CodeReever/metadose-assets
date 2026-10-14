import { randomUUID } from 'node:crypto';
import { and, eq, gte, lte, like, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { activityLog } from '$lib/server/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export async function logActivity(
	tx: Tx,
	params: {
		organizationId: string;
		recordId?: string;
		objectTypeId?: string;
		actorUserId?: string;
		action: string;
		summary?: string;
		changes?: { before?: unknown; after?: unknown };
	}
) {
	await tx.insert(activityLog).values({
		id: randomUUID(),
		organizationId: params.organizationId,
		recordId: params.recordId,
		objectTypeId: params.objectTypeId,
		actorUserId: params.actorUserId,
		action: params.action,
		summary: params.summary,
		changes: params.changes
	});
}

export async function listActivityForRecord(organizationId: string, recordId: string) {
	return db.query.activityLog.findMany({
		where: and(eq(activityLog.organizationId, organizationId), eq(activityLog.recordId, recordId)),
		with: { actor: true },
		orderBy: (a, { desc }) => desc(a.createdAt)
	});
}

export async function listOrgActivity(organizationId: string, limit = 10) {
	return db.query.activityLog.findMany({
		where: eq(activityLog.organizationId, organizationId),
		with: { actor: true, record: { with: { objectType: true } } },
		orderBy: (a, { desc }) => desc(a.createdAt),
		limit
	});
}

/** The distinct resource prefixes seen in `action` values (e.g. 'record.checked_out' -> 'record') — drives the category filter on the logs page. */
export const ACTIVITY_CATEGORIES = [
	'record',
	'attachment',
	'location',
	'manufacturer',
	'category',
	'condition',
	'field_definition',
	'object_type',
	'member',
	'report'
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface ActivityFilters {
	category?: string;
	action?: string;
	actorUserId?: string;
	search?: string;
	from?: Date;
	to?: Date;
	page?: number;
	pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;

export async function listActivity(organizationId: string, filters: ActivityFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

	const conditions = [eq(activityLog.organizationId, organizationId)];
	if (filters.category) conditions.push(like(activityLog.action, `${filters.category}.%`));
	if (filters.action) conditions.push(eq(activityLog.action, filters.action));
	if (filters.actorUserId) conditions.push(eq(activityLog.actorUserId, filters.actorUserId));
	if (filters.from) conditions.push(gte(activityLog.createdAt, filters.from));
	if (filters.to) conditions.push(lte(activityLog.createdAt, filters.to));
	if (filters.search) conditions.push(like(activityLog.summary, `%${filters.search}%`));
	const where = and(...conditions);

	const [rows, [{ count }]] = await Promise.all([
		db.query.activityLog.findMany({
			where,
			with: { actor: true, record: { with: { objectType: true } }, objectType: true },
			orderBy: (a, { desc }) => desc(a.createdAt),
			limit: pageSize,
			offset: (page - 1) * pageSize
		}),
		db.select({ count: sql<number>`count(*)` }).from(activityLog).where(where)
	]);

	return { rows, total: Number(count), page, pageSize };
}

/** Every distinct `action` value this org's log actually contains — populates the action sub-filter without hardcoding a list that'll drift from reality. */
export async function listDistinctActions(organizationId: string): Promise<string[]> {
	const rows = await db
		.selectDistinct({ action: activityLog.action })
		.from(activityLog)
		.where(eq(activityLog.organizationId, organizationId))
		.orderBy(activityLog.action);
	return rows.map((r) => r.action);
}
