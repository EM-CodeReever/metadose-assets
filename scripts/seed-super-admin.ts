/**
 * Bootstraps the very first instance super-admin.
 *
 * There's an intentional chicken-and-egg gap in the app itself: self-service
 * sign-up is disabled (`emailAndPassword.disableSignUp`) and `auth.api.createUser`
 * requires an existing super-admin session, so a brand-new deployment has no way
 * to create its first user through the UI. This script writes the user/account
 * rows directly, using better-auth's own password hashing so the resulting
 * credential is valid for a normal `/login` sign-in afterwards.
 *
 * Usage: npm run db:seed-admin -- <email> <password> [name]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';

const [, , email, password, name] = process.argv;

if (!email || !password) {
	console.error('Usage: npm run db:seed-admin -- <email> <password> [name]');
	process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const conn = await mysql.createConnection(databaseUrl);

try {
	const [existing] = await conn.execute('SELECT id FROM user WHERE email = ?', [email]);
	if (Array.isArray(existing) && existing.length > 0) {
		console.error(`A user with email ${email} already exists.`);
		process.exit(1);
	}

	const userId = randomUUID();
	const now = new Date();

	await conn.execute(
		'INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[userId, name ?? 'Super Admin', email, true, now, now, 'super_admin']
	);

	const hashedPassword = await hashPassword(password);
	await conn.execute(
		'INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[randomUUID(), userId, 'credential', userId, hashedPassword, now, now]
	);

	console.log(`Created super-admin ${email} (${userId})`);
} finally {
	await conn.end();
}
