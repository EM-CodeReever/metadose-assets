import { and, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { member as memberTable, organization as organizationTable, session as sessionTable, user as userTable } from '$lib/server/db/schema';
import { verifyAndSyncLdapPassword } from '$lib/server/services/ldapAuth';
import type { Actions, PageServerLoad } from './$types';

/** Only allow same-origin relative paths, to prevent an open-redirect via ?redirectTo=. */
function safeRedirectTarget(target: string | null | undefined): string {
	if (target && target.startsWith('/') && !target.startsWith('//')) return target;
	return '/';
}

/**
 * For an `authSource: 'ldap'` account, verifies against the live directory (and mirrors the
 * password locally) before the normal `signInEmail` call below — the local password hash is
 * never meaningful on its own for these accounts, only kept in sync to let that one call stay
 * the single code path. Local/CSV-imported accounts skip this entirely and behave exactly as
 * before. Never throws — a lookup miss or LDAP failure just falls through to the ordinary
 * `signInEmail` invalid-credentials error, so this can't be used to probe which emails exist.
 */
async function syncLdapAccountIfNeeded(email: string, password: string): Promise<void> {
	const existing = await db.query.user.findFirst({ where: eq(userTable.email, email) });
	if (existing?.authSource !== 'ldap') return;
	await verifyAndSyncLdapPassword(existing.id, email, password);
}

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		throw redirect(302, '/');
	}
	const organizations = await db.query.organization.findMany({ orderBy: (o, { asc }) => asc(o.name) });
	return {
		organizations,
		redirectTo: safeRedirectTarget(event.url.searchParams.get('redirectTo')),
		defaultTab: event.url.searchParams.get('as') === 'admin' ? ('admin' as const) : ('user' as const)
	};
};

export const actions: Actions = {
	user: async (event) => {
		const formData = await event.request.formData();
		const organizationId = formData.get('organizationId')?.toString() ?? '';
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const redirectTo = safeRedirectTarget(formData.get('redirectTo')?.toString());

		if (!organizationId) {
			return fail(400, { tab: 'user', message: 'Choose your organization', email, organizationId });
		}

		await syncLdapAccountIfNeeded(email, password);

		let user: { id: string; role?: string | null };
		let token: string;
		try {
			const result = await auth.api.signInEmail({
				headers: event.request.headers,
				body: { email, password }
			});
			user = result.user;
			token = result.token;
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { tab: 'user', message: err.message || 'Invalid email or password', email, organizationId });
			}
			throw err;
		}

		// Instance admins don't sign in through this tab at all, even with the right password —
		// they have their own door. Same reasoning as the admin tab's mirror-image check below:
		// `signInEmail` already created a session to verify the password, so it's torn down
		// directly rather than via `auth.api.signOut` (which would read the pre-login request's
		// stale cookie headers, not the one this sign-in's response just set). Deleted by token,
		// not userId, so an admin's existing session elsewhere isn't collateral damage.
		if (user.role === 'super_admin') {
			await db.delete(sessionTable).where(eq(sessionTable.token, token));
			return fail(403, {
				tab: 'user',
				message: 'Instance admins sign in from the INT Admin tab instead.',
				email,
				organizationId
			});
		}

		const organization = await db.query.organization.findFirst({ where: eq(organizationTable.id, organizationId) });
		const membership = organization
			? await db.query.member.findFirst({
					where: and(eq(memberTable.organizationId, organization.id), eq(memberTable.userId, user.id))
				})
			: undefined;

		if (organization && membership) {
			throw redirect(302, redirectTo !== '/' ? redirectTo : `/o/${organization.slug}`);
		}

		// Valid credentials, but not a member of the organization they picked — say so explicitly
		// rather than silently landing them somewhere else, so it's clear it's the ORG that's
		// wrong, not their email/password.
		return fail(400, {
			tab: 'user',
			message: `You don't have access to ${organization?.name ?? 'that organization'}. Choose one of your own organizations and try again.`,
			email,
			organizationId
		});
	},

	admin: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const redirectTo = formData.get('redirectTo')?.toString();
		const target = redirectTo && redirectTo.startsWith('/admin') ? redirectTo : '/admin';

		await syncLdapAccountIfNeeded(email, password);

		let user: { role?: string | null };
		let token: string;
		try {
			const result = await auth.api.signInEmail({
				headers: event.request.headers,
				body: { email, password }
			});
			user = result.user;
			token = result.token;
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { tab: 'admin', message: err.message || 'Invalid email or password', email });
			}
			throw err;
		}

		// Only instance (super) admins may authenticate through this tab at all — right
		// credentials or not, a non-admin account never gets a live session out of this door.
		// `signInEmail` already created one (that's the only way to verify the password), so it's
		// torn down again immediately: deleting the session row directly is necessary here, not
		// `auth.api.signOut`, since that reads the session cookie from the *request* headers, which
		// still reflect the pre-login request — the cookie this session just set only exists on
		// the outgoing response so far.
		if (user.role !== 'super_admin') {
			await db.delete(sessionTable).where(eq(sessionTable.token, token));
			return fail(403, {
				tab: 'admin',
				message: 'This sign-in is for instance administrators only. Use the User tab instead.',
				email
			});
		}

		throw redirect(302, target);
	}
};
