/**
 * Applies pending migrations from ./drizzle, run as a standalone script (not through
 * `drizzle-kit migrate`, which has repeatedly hung/failed silently in this project's dev shell —
 * see commit history). Used both in local dev (`npm run db:migrate:run`) and as the Docker
 * entrypoint's migration step before the server starts.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const connection = await mysql.createConnection(databaseUrl);
const db = drizzle(connection);

console.log('Applying migrations from ./drizzle ...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied.');

await connection.end();
