import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { addUserToOrganization, type OrgRoleName } from './members';

export const MAX_IMPORT_ROWS = 2000;

export interface ImportRowResult {
	row: number;
	success: boolean;
	message?: string;
}

/** Never shown to anyone — the user sets their own password via the "forgot password" flow. */
function generateTempPassword(): string {
	return randomBytes(16).toString('base64url');
}

/**
 * Finds-or-creates a user by email and, if an org/role is given, adds them to it — the one
 * per-person operation shared by bulk CSV user import and LDAP sync, each just supplying its own
 * list of {name, email} entries from a different source.
 */
export async function provisionUser(params: {
	name: string;
	email: string;
	organizationId?: string;
	role?: OrgRoleName;
	authSource?: 'local' | 'ldap';
	requestHeaders: Headers;
	actorUserId: string;
}): Promise<void> {
	const authSource = params.authSource ?? 'local';
	let userId: string;

	const existing = await db.query.user.findFirst({ where: eq(userTable.email, params.email) });
	if (existing) {
		userId = existing.id;
		// A sync confirming this email also exists in LDAP flips a local account over — from
		// then on its directory password is authoritative, not whatever local one it has.
		if (authSource === 'ldap' && existing.authSource !== 'ldap') {
			await db.update(userTable).set({ authSource: 'ldap' }).where(eq(userTable.id, userId));
		}
	} else {
		const created = await auth.api.createUser({
			headers: params.requestHeaders,
			body: { name: params.name, email: params.email, password: generateTempPassword(), role: 'user', data: { authSource } }
		});
		userId = created.user.id;

		if (authSource === 'local') {
			// Fire-and-forget: reuses better-auth's own forgot-password flow (same endpoint the
			// public /forgot-password page calls) so the new user gets a real "set your password"
			// email — degrades to a console log, not an error, when SMTP isn't configured yet. An
			// 'ldap' account skips this: its local password is never meaningful on its own, only
			// ever a mirror of whatever they just typed at their last successful LDAP sign-in.
			await auth.api.requestPasswordReset({ body: { email: params.email, redirectTo: '/reset-password' } });
		}
	}

	if (params.organizationId && params.role) {
		await addUserToOrganization(params.organizationId, userId, params.role, params.requestHeaders, params.actorUserId);
	}
}

export async function importUsers(params: {
	rows: { name: string; email: string }[];
	organizationId?: string;
	role?: OrgRoleName;
	authSource?: 'local' | 'ldap';
	requestHeaders: Headers;
	actorUserId: string;
}): Promise<{ results: ImportRowResult[]; created: number; failed: number }> {
	const results: ImportRowResult[] = [];
	const seenEmails = new Set<string>();

	for (let i = 0; i < params.rows.length; i++) {
		const rowNumber = i + 1;
		const name = params.rows[i].name?.trim();
		const email = params.rows[i].email?.trim().toLowerCase();

		if (!name || !email) {
			results.push({ row: rowNumber, success: false, message: 'Name and email are required' });
			continue;
		}
		if (seenEmails.has(email)) {
			results.push({ row: rowNumber, success: false, message: 'Another row in this file already has that email' });
			continue;
		}

		try {
			await provisionUser({
				name,
				email,
				organizationId: params.organizationId,
				role: params.role,
				authSource: params.authSource,
				requestHeaders: params.requestHeaders,
				actorUserId: params.actorUserId
			});
			seenEmails.add(email);
			results.push({ row: rowNumber, success: true });
		} catch (err) {
			const message = err instanceof APIError ? err.message : err instanceof Error ? err.message : 'Could not create user';
			results.push({ row: rowNumber, success: false, message });
		}
	}

	return {
		results,
		created: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length
	};
}
