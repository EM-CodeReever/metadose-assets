import { env } from '$env/dynamic/private';
import nodemailer from 'nodemailer';
import { getInstanceSettings } from '$lib/server/services/settings';

interface ResolvedSmtpConfig {
	host: string;
	port: number;
	secure: boolean;
	user?: string;
	pass?: string;
	from: string;
}

/**
 * DB-stored settings (configurable from the admin console) win over env vars field-by-field, so
 * an instance can set the host/port in the UI while still falling back to an env-configured
 * password, or vice versa. No caching — SMTP settings change rarely and nodemailer transporter
 * construction is cheap (it doesn't connect until sendMail is called), so always reading the
 * latest config is simpler than invalidating a cache on save.
 */
async function resolveSmtpConfig(): Promise<ResolvedSmtpConfig | null> {
	const stored = await getInstanceSettings();

	const host = stored?.smtpHost || env.SMTP_HOST;
	if (!host) return null;

	return {
		host,
		port: stored?.smtpPort || Number(env.SMTP_PORT) || 587,
		secure: stored?.smtpSecure ?? env.SMTP_SECURE === 'true',
		user: stored?.smtpUser || env.SMTP_USER || undefined,
		pass: stored?.smtpPass || env.SMTP_PASS || undefined,
		from: stored?.smtpFrom || env.SMTP_FROM || 'no-reply@localhost'
	};
}

export interface SendEmailParams {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

/** Strips tags for a plain-text fallback; good enough for the simple emails this app sends. */
function htmlToText(html: string): string {
	return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Sends an email via SMTP, or logs it to the console when SMTP isn't configured — so every
 * caller can fire-and-forget without worrying about whether mail delivery is set up yet. Returns
 * whether it actually went out over SMTP (vs. just being logged), so callers that need to know —
 * like the admin "send test email" button — can tell the difference.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ delivered: boolean }> {
	const config = await resolveSmtpConfig();
	if (!config) {
		console.log(`[email] SMTP not configured — would have sent "${params.subject}" to ${params.to}`);
		return { delivered: false };
	}

	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: config.user ? { user: config.user, pass: config.pass } : undefined
	});

	await transporter.sendMail({
		from: config.from,
		to: params.to,
		subject: params.subject,
		html: params.html,
		text: params.text ?? htmlToText(params.html)
	});

	return { delivered: true };
}
