import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { location } from '$lib/server/db/schema';
import { logActivity } from './activityLog';

export async function listLocations(organizationId: string) {
	return db.query.location.findMany({
		where: eq(location.organizationId, organizationId),
		orderBy: (l, { asc }) => asc(l.name)
	});
}

export async function createLocation(params: {
	organizationId: string;
	name: string;
	address?: string;
	actorUserId: string;
}): Promise<{ id: string; name: string }> {
	const id = randomUUID();
	await db.transaction(async (tx) => {
		await tx.insert(location).values({
			id,
			organizationId: params.organizationId,
			name: params.name,
			address: params.address
		});
		await logActivity(tx, {
			organizationId: params.organizationId,
			actorUserId: params.actorUserId,
			action: 'location.created',
			summary: `Added location "${params.name}"`
		});
	});
	return { id, name: params.name };
}

export async function deleteLocation(organizationId: string, locationId: string, actorUserId: string) {
	const existing = await db.query.location.findFirst({
		where: and(eq(location.organizationId, organizationId), eq(location.id, locationId))
	});
	await db.transaction(async (tx) => {
		await tx.delete(location).where(and(eq(location.organizationId, organizationId), eq(location.id, locationId)));
		await logActivity(tx, {
			organizationId,
			actorUserId,
			action: 'location.deleted',
			summary: existing ? `Deleted location "${existing.name}"` : 'Deleted a location'
		});
	});
}
