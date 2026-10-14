import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * For Docker/Compose `healthcheck:` and orchestrator liveness/readiness probes. Confirms the
 * process can actually reach the database, not just that the HTTP server is up — a hung DB
 * connection is the more likely real-world failure mode here.
 */
export const GET: RequestHandler = async () => {
	try {
		await db.execute(sql`select 1`);
	} catch {
		return json({ status: 'error', db: false }, { status: 503 });
	}
	return json({ status: 'ok', db: true });
};
