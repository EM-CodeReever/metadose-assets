import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lookupValue } from '$lib/server/db/schema';
import type { LookupKind } from '$lib/server/db/lookup.schema';
import { logActivity } from './activityLog';

export { LOOKUP_KINDS, type LookupKind } from '$lib/server/db/lookup.schema';

export async function listLookupValues(organizationId: string, kind: LookupKind) {
	return db.query.lookupValue.findMany({
		where: and(eq(lookupValue.organizationId, organizationId), eq(lookupValue.kind, kind)),
		orderBy: (l, { asc }) => [asc(l.sortOrder), asc(l.name)]
	});
}

/** All three lists in one call, keyed by kind — convenient for pages that render multiple reference fields. */
export async function listAllLookupValues(organizationId: string) {
	const [manufacturers, categories, conditions] = await Promise.all([
		listLookupValues(organizationId, 'manufacturer'),
		listLookupValues(organizationId, 'category'),
		listLookupValues(organizationId, 'condition')
	]);
	return { manufacturer: manufacturers, category: categories, condition: conditions };
}

export async function createLookupValue(
	organizationId: string,
	kind: LookupKind,
	name: string,
	outOfService = false,
	actorUserId?: string
): Promise<{ id: string; name: string }> {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Name is required');

	const existing = await db.query.lookupValue.findFirst({
		where: and(
			eq(lookupValue.organizationId, organizationId),
			eq(lookupValue.kind, kind),
			sql`lower(${lookupValue.name}) = lower(${trimmed})`
		)
	});
	if (existing) throw new Error(`"${trimmed}" already exists`);

	const existingCount = await db.query.lookupValue.findMany({
		where: and(eq(lookupValue.organizationId, organizationId), eq(lookupValue.kind, kind))
	});

	const id = randomUUID();
	await db.transaction(async (tx) => {
		await tx.insert(lookupValue).values({
			id,
			organizationId,
			kind,
			name: trimmed,
			sortOrder: existingCount.length,
			outOfService: kind === 'condition' ? outOfService : false
		});
		if (actorUserId) {
			await logActivity(tx, {
				organizationId,
				actorUserId,
				action: `${kind}.created`,
				summary: `Added ${kind} "${trimmed}"`
			});
		}
	});

	return { id, name: trimmed };
}

export async function deleteLookupValue(organizationId: string, id: string, actorUserId: string): Promise<void> {
	const existing = await db.query.lookupValue.findFirst({
		where: and(eq(lookupValue.organizationId, organizationId), eq(lookupValue.id, id))
	});
	await db.transaction(async (tx) => {
		await tx.delete(lookupValue).where(and(eq(lookupValue.organizationId, organizationId), eq(lookupValue.id, id)));
		if (existing) {
			await logActivity(tx, {
				organizationId,
				actorUserId,
				action: `${existing.kind}.deleted`,
				summary: `Deleted ${existing.kind} "${existing.name}"`
			});
		}
	});
}

/** Only meaningful for kind='condition' rows — see the column's own comment in lookup.schema.ts. */
export async function setLookupValueOutOfService(
	organizationId: string,
	id: string,
	outOfService: boolean,
	actorUserId: string
): Promise<void> {
	const existing = await db.query.lookupValue.findFirst({
		where: and(eq(lookupValue.organizationId, organizationId), eq(lookupValue.id, id), eq(lookupValue.kind, 'condition'))
	});
	await db.transaction(async (tx) => {
		await tx
			.update(lookupValue)
			.set({ outOfService })
			.where(and(eq(lookupValue.organizationId, organizationId), eq(lookupValue.id, id), eq(lookupValue.kind, 'condition')));
		if (existing) {
			await logActivity(tx, {
				organizationId,
				actorUserId,
				action: 'condition.updated',
				summary: `Marked condition "${existing.name}" as ${outOfService ? 'out of service' : 'in service'}`
			});
		}
	});
}

const DEFAULT_CATEGORIES = [
	'Laptop',
	'Desktop',
	'Display Monitor',
	'Server',
	'Printer',
	'Toner/Ink',
	'Mouse',
	'Keyboard',
	'IP Desk Phone',
	'Headset',
	'Webcam',
	'Docking Station',
	'Router/Switch',
	'Network Cable',
	'UPS/Power Supply',
	'Mobile Phone',
	'Tablet',
	'RAM Module',
	'Storage Drive',
	'Battery',
	'Software License'
];

const DEFAULT_CATEGORY_SEED = DEFAULT_CATEGORIES.map((name) => ({ name, outOfService: false }));
const DEFAULT_CONDITION_SEED = [
	{ name: 'Working — no fault', outOfService: false },
	{ name: 'Working — minor fault', outOfService: false },
	{ name: 'Not working', outOfService: false },
	{ name: 'Retired', outOfService: true },
	{ name: 'Disposed', outOfService: true }
];

/** Idempotent — only seeds a kind if it currently has zero rows for this org. Manufacturers stay empty by design. */
export async function ensureDefaultLookupValues(organizationId: string): Promise<void> {
	const seeds: [LookupKind, { name: string; outOfService: boolean }[]][] = [
		['category', DEFAULT_CATEGORY_SEED],
		['condition', DEFAULT_CONDITION_SEED]
	];

	for (const [kind, entries] of seeds) {
		const existing = await listLookupValues(organizationId, kind);
		if (existing.length > 0) continue;

		await db.insert(lookupValue).values(
			entries.map((entry, index) => ({
				id: randomUUID(),
				organizationId,
				kind,
				name: entry.name,
				sortOrder: index,
				outOfService: kind === 'condition' ? entry.outOfService : false
			}))
		);
	}
}
