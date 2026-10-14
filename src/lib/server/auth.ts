import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { admin } from 'better-auth/plugins/admin';
import { organization } from 'better-auth/plugins/organization';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { orgAc, orgRoles, siteAc, siteRoles } from '$lib/server/permissions';
import { sendEmail } from '$lib/server/email';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'mysql' }),
	// No self-service sign-up: accounts are created by an admin via auth.api.createUser.
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: 'Reset your password',
				html: `<p>Someone requested a password reset for your account.</p><p><a href="${url}">Click here to reset your password</a></p><p>If you didn't request this, you can ignore this email.</p>`
			});
		}
	},
	user: {
		additionalFields: {
			// Which credential is authoritative for this account. 'local' checks the normal
			// stored password hash as usual; 'ldap' instead verifies via a live LDAP bind at sign-in
			// time (see $lib/server/services/ldapAuth.ts), mirroring the verified password into the
			// local hash afterward purely so the one `signInEmail` call still works either way.
			authSource: {
				type: 'string',
				required: false,
				defaultValue: 'local',
				input: true
			},
			// Settable at creation (`auth.api.createUser({ ..., data: { mustChangePassword: true } })`)
			// by the instance-admin "create user" flow when the admin sets the initial password
			// themselves, rather than emailing the user a set-your-own-password link.
			mustChangePassword: {
				type: 'boolean',
				required: false,
				defaultValue: false,
				input: true
			}
		}
	},
	plugins: [
		admin({
			// Instance-wide super-admin flag, separate from per-organization roles below.
			ac: siteAc,
			roles: siteRoles,
			defaultRole: 'user',
			adminRoles: ['super_admin']
		}),
		organization({
			ac: orgAc,
			roles: orgRoles,
			creatorRole: 'owner',
			teams: { enabled: false },
			// Organizations are provisioned by instance super-admins, not created by end users.
			allowUserToCreateOrganization: (user) => user.role === 'super_admin'
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
