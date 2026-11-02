import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { emailTemplate } from '$lib/server/db/emailTemplate.schema';

export type EmailTemplateKey =
	| 'password_reset'
	| 'added_to_org'
	| 'checkout_reminder'
	| 'ldap_welcome'
	| 'maintenance_due';

interface TemplateDef {
	key: EmailTemplateKey;
	label: string;
	description: string;
	defaultSubject: string;
	defaultHtml: string;
	/** Variable names this template can reference as `{{name}}` — shown in the editor as a hint. */
	variables: string[];
	/** Sample values for the editor's preview, so a blank `{{var}}` doesn't render literally. */
	sampleValues: Record<string, string>;
}

// Defaults are copied verbatim from what was previously hardcoded inline at each call site —
// editing a template here changes nothing until an admin actually saves a row for that key.
export const TEMPLATE_DEFS: Record<EmailTemplateKey, TemplateDef> = {
	password_reset: {
		key: 'password_reset',
		label: 'Password reset',
		description: 'Sent when anyone requests a password reset, including new local accounts asked to set their own password.',
		defaultSubject: 'Reset your password',
		defaultHtml:
			"<p>Someone requested a password reset for your account.</p><p><a href=\"{{url}}\">Click here to reset your password</a></p><p>If you didn't request this, you can ignore this email.</p>",
		variables: ['url'],
		sampleValues: { url: 'https://example.com/reset-password?token=sample' }
	},
	added_to_org: {
		key: 'added_to_org',
		label: 'Added to organization',
		description: 'Sent when someone is added to an organization — by an admin, CSV import, or LDAP sync.',
		defaultSubject: "You've been added to {{organizationName}}",
		defaultHtml:
			'<p>You now have <strong>{{role}}</strong> access to <strong>{{organizationName}}</strong>.</p><p><a href="{{orgUrl}}">Open {{organizationName}}</a></p>',
		variables: ['organizationName', 'role', 'orgUrl'],
		sampleValues: { organizationName: 'Acme Inc.', role: 'manager', orgUrl: 'https://example.com/o/acme' }
	},
	checkout_reminder: {
		key: 'checkout_reminder',
		label: 'Checkout acceptance reminder',
		description: 'Sent when a manager nudges someone to confirm receipt of a checkout still awaiting their acknowledgment.',
		defaultSubject: 'Reminder: confirm receipt of {{recordName}}',
		defaultHtml:
			'<p><strong>{{recordName}}</strong> was checked out to you and is still awaiting your confirmation of receipt.</p><p><a href="{{link}}">View it and confirm receipt</a></p>',
		variables: ['recordName', 'link'],
		sampleValues: { recordName: 'MacBook Pro 14"', link: 'https://example.com/o/acme/assets/sample' }
	},
	ldap_welcome: {
		key: 'ldap_welcome',
		label: 'Welcome (LDAP-synced account)',
		description:
			'Optional — only sent when an admin opts in while syncing from LDAP. A password-reset link doesn\'t make sense here since these accounts authenticate against the directory, not a local password.',
		defaultSubject: 'Your account is ready',
		defaultHtml:
			'<p>Hi {{name}},</p><p>An account has been set up for you. Sign in with your usual directory username and password at:</p><p><a href="{{loginUrl}}">{{loginUrl}}</a></p>',
		variables: ['name', 'loginUrl'],
		sampleValues: { name: 'Jane Doe', loginUrl: 'https://example.com/login' }
	},
	maintenance_due: {
		key: 'maintenance_due',
		label: 'Maintenance due',
		description:
			'Sent once an asset\'s scheduled maintenance check becomes due, then again once a day for as long as it stays overdue — to whoever it\'s checked out to plus the organization\'s owners/admins/managers. Stops the moment the check is performed.',
		defaultSubject: 'Maintenance due: {{recordName}}',
		defaultHtml:
			'<p><strong>{{recordName}}</strong> ({{objectTypeName}}) was due for a maintenance check on {{dueDate}}.</p><p><a href="{{link}}">View it and perform the check</a></p>',
		variables: ['recordName', 'objectTypeName', 'dueDate', 'link'],
		sampleValues: {
			recordName: 'MacBook Pro 14"',
			objectTypeName: 'Assets',
			dueDate: '2026-01-15',
			link: 'https://example.com/o/acme/assets/sample'
		}
	}
};

/** Fills `{{varName}}` placeholders — intentionally simple (no escaping/logic), matching the
 *  level of sophistication these emails have always had as hand-written template literals. */
function interpolate(text: string, vars: Record<string, string>): string {
	return text.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in vars ? vars[name] : match));
}

export async function getEmailTemplate(key: EmailTemplateKey): Promise<{ subject: string; html: string }> {
	const row = await db.query.emailTemplate.findFirst({ where: eq(emailTemplate.key, key) });
	if (row) return { subject: row.subject, html: row.html };
	const def = TEMPLATE_DEFS[key];
	return { subject: def.defaultSubject, html: def.defaultHtml };
}

export async function listEmailTemplates() {
	const rows = await db.query.emailTemplate.findMany();
	const byKey = new Map(rows.map((r) => [r.key, r]));
	return Object.values(TEMPLATE_DEFS).map((def) => {
		const override = byKey.get(def.key);
		return {
			key: def.key,
			label: def.label,
			description: def.description,
			variables: def.variables,
			sampleValues: def.sampleValues,
			subject: override?.subject ?? def.defaultSubject,
			html: override?.html ?? def.defaultHtml,
			isCustomized: !!override
		};
	});
}

export async function upsertEmailTemplate(key: EmailTemplateKey, params: { subject: string; html: string }): Promise<void> {
	const existing = await db.query.emailTemplate.findFirst({ where: eq(emailTemplate.key, key) });
	if (existing) {
		await db.update(emailTemplate).set({ subject: params.subject, html: params.html }).where(eq(emailTemplate.key, key));
	} else {
		await db.insert(emailTemplate).values({ key, subject: params.subject, html: params.html });
	}
}

export async function resetEmailTemplate(key: EmailTemplateKey): Promise<void> {
	await db.delete(emailTemplate).where(eq(emailTemplate.key, key));
}

/** Fetches the stored (or default) template for `key` and interpolates `vars` into both fields. */
export async function renderTemplate(
	key: EmailTemplateKey,
	vars: Record<string, string>
): Promise<{ subject: string; html: string }> {
	const { subject, html } = await getEmailTemplate(key);
	return { subject: interpolate(subject, vars), html: interpolate(html, vars) };
}
