import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organization as organizationTable } from '$lib/server/db/schema';
import { findDueMaintenanceRecords, markMaintenanceNotified } from './maintenance';
import { getCurrentCheckoutsByRecordId } from './checkouts';
import { listOrgUsers } from './members';
import { sendEmail } from '$lib/server/email';
import { renderTemplate } from './emailTemplates';

const RECIPIENT_ROLES = new Set(['owner', 'admin', 'manager']);

/**
 * Finds every record that's due (and not already notified today), emails whoever it's checked out
 * to plus the organization's owners/admins/managers, and marks it notified — called hourly from
 * `hooks.server.ts`. Polling hourly against the date-based "already notified today" check is what
 * actually delivers "once when due, then once a day while overdue": the sweep itself doesn't need
 * to know or care about that cadence, it just re-evaluates the same simple condition often enough.
 */
export async function runMaintenanceCheckSweep(): Promise<void> {
	const dueRecords = await findDueMaintenanceRecords();
	if (dueRecords.length === 0) return;

	const orgCache = new Map<string, { id: string; name: string; slug: string }>();
	const recipientsCache = new Map<string, string[]>();

	for (const rec of dueRecords) {
		try {
			let org = orgCache.get(rec.organizationId);
			if (!org) {
				const found = await db.query.organization.findFirst({ where: eq(organizationTable.id, rec.organizationId) });
				if (!found) continue;
				org = found;
				orgCache.set(rec.organizationId, org);
			}

			let adminEmails = recipientsCache.get(rec.organizationId);
			if (!adminEmails) {
				const orgUsers = await listOrgUsers(rec.organizationId);
				adminEmails = orgUsers.filter((u) => RECIPIENT_ROLES.has(u.orgRole)).map((u) => u.email);
				recipientsCache.set(rec.organizationId, adminEmails);
			}

			const [checkout] = (await getCurrentCheckoutsByRecordId(rec.organizationId, [rec.id])).values();
			const assigneeEmail = checkout?.assignedToUser?.email;

			const recipients = new Set(adminEmails);
			if (assigneeEmail) recipients.add(assigneeEmail);
			if (recipients.size === 0) {
				await markMaintenanceNotified(rec.id);
				continue;
			}

			const recordName = String(rec.data.values.name ?? rec.objectType.name);
			const link = `${env.ORIGIN ?? ''}/o/${org.slug}/${rec.objectType.slug}/${rec.id}`;
			const { subject, html } = await renderTemplate('maintenance_due', {
				recordName,
				objectTypeName: rec.objectType.name,
				dueDate: rec.maintenanceDueAt ? rec.maintenanceDueAt.toLocaleDateString() : '',
				link
			});

			// Each recipient is independent — one bad/rejected address (and a real SMTP server will
			// reject plenty, e.g. typos or someone who's left) must never stop the others on this
			// same record from being notified, nor stop the record from being marked notified.
			for (const to of recipients) {
				try {
					await sendEmail({ to, subject, html });
				} catch (err) {
					console.error(`[maintenance sweep] failed to email ${to} for record ${rec.id}`, err);
				}
			}
			await markMaintenanceNotified(rec.id);
		} catch (err) {
			// Likewise, one record failing outright (a bad org lookup, a thrown query) must never
			// stop the rest of this sweep's batch from being processed.
			console.error(`[maintenance sweep] failed to process record ${rec.id}`, err);
		}
	}
}
