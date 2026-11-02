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
import { renderTemplate } from '$lib/server/services/emailTemplates';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'mysql' }),
	// No self-service sign-up: accounts are created by an admin via auth.api.createUser.
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		sendResetPassword: async ({ user, url }) => {
			const { subject, html } = await renderTemplate('password_reset', { url });
			await sendEmail({ to: user.email, subject, html });
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
			allowUserToCreateOrganization: (user) => user.role === 'super_admin',
			// No real cap on how many people belong to one organization — an instance's scale
			// is a matter of whatever infrastructure it's run on, not something this app should
			// silently limit. better-auth defaults this to 100 and enforces it on every
			// add-member path (including CSV/LDAP bulk sync, which can hand it far more than
			// that in one batch), so it has to be raised explicitly rather than left unset.
			// Kept as a large finite number rather than Infinity — this same value also doubles
			// as the default page size for better-auth's own member-listing endpoint (unused
			// here, but Infinity isn't a valid SQL LIMIT if anything ever calls it), so a
			// million is effectively uncapped without risking that.
			membershipLimit: 1_000_000
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
