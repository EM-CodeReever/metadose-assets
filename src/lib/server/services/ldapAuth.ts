import { and, eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from '$lib/server/db';
import { account as accountTable } from '$lib/server/db/schema';
import { getLdapConfig, verifyLdapCredentials } from './ldap';

/**
 * For an `authSource: 'ldap'` account: verifies the submitted password via a live LDAP bind
 * (the directory stays authoritative), then mirrors it into the local password hash so the
 * normal `signInEmail` call right after this succeeds through the usual code path — the rest of
 * the app never needs to know a login came via LDAP. Returns false without changing anything if
 * LDAP rejects the credential, isn't reachable, or isn't configured.
 */
export async function verifyAndSyncLdapPassword(userId: string, email: string, password: string): Promise<boolean> {
	const config = await getLdapConfig().catch(() => undefined);
	if (!config) return false;

	const verified = await verifyLdapCredentials(config, email, password);
	if (!verified) return false;

	const hashedPassword = await hashPassword(password);
	await db
		.update(accountTable)
		.set({ password: hashedPassword })
		.where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'credential')));

	return true;
}
