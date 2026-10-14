import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// Two separate fixes, both required: MySQL's session time_zone defaults to 'SYSTEM' (this
// box: America/Jamaica, UTC-5), so its TIMESTAMP columns get silently converted between that
// and UTC on every read/write — `SET time_zone` on each new connection removes that layer.
// Separately, mysql2 returns a JS Date (not a string) for TIMESTAMP columns by default, and
// drizzle-orm's mysql `timestamp` mapFromDriverValue does `value + '+0000'` assuming a string
// — concatenating a Date coerces it through `Date.prototype.toString()` (LOCAL time),
// corrupting the value by the local UTC offset a second time. `dateStrings: true` makes
// mysql2 hand Drizzle a plain string instead, which is what that mapper actually expects.
// (mysql2's own `timezone` option only affects its client-side Date parsing, which dateStrings
// bypasses entirely — it does not touch the server's session, hence the explicit SET below.)
const client = mysql.createPool({ uri: env.DATABASE_URL, dateStrings: true });
client.on('connection', (connection) => {
	connection.query("SET time_zone = '+00:00'");
});

export const db = drizzle(client, { schema, mode: 'default' });

// Docker sends SIGTERM on `docker stop`/`docker compose down`; without this the pool's sockets
// get torn down by the OS mid-query instead of draining cleanly, and `docker stop` waits out the
// full grace period (default 10s) before SIGKILL since Node never exits on its own.
let shuttingDown = false;
async function shutdown() {
	if (shuttingDown) return;
	shuttingDown = true;
	await client.end().catch(() => {});
	process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
