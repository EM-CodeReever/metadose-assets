import { eq, or } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import {
	user,
	session,
	account,
	member,
	activityLog,
	checkoutRequest,
	attachment,
	checkout,
	objectType,
	record,
	reportDefinition
} from '$lib/server/db/schema';

/**
 * Whether this account has left any real trace anywhere — as a checkout's holder, as whoever
 * checked something in/out, requested or decided a request, uploaded an attachment, or created/
 * updated a record/object type/report. None of these foreign keys cascade-delete (unlike
 * session/account/member, which do), by design: they're audit trail, not "this user's data" —
 * deleting the account should never silently erase what actually happened in an org.
 */
export async function userHasHistory(userId: string): Promise<boolean> {
	const checks = await Promise.all([
		db.query.activityLog.findFirst({ where: eq(activityLog.actorUserId, userId) }),
		db.query.checkoutRequest.findFirst({
			where: or(eq(checkoutRequest.requestedByUserId, userId), eq(checkoutRequest.decidedBy, userId))
		}),
		db.query.attachment.findFirst({ where: eq(attachment.uploadedBy, userId) }),
		db.query.checkout.findFirst({
			where: or(
				eq(checkout.assignedToUserId, userId),
				eq(checkout.checkedOutBy, userId),
				eq(checkout.checkedInBy, userId)
			)
		}),
		db.query.objectType.findFirst({ where: eq(objectType.createdBy, userId) }),
		db.query.record.findFirst({ where: or(eq(record.createdBy, userId), eq(record.updatedBy, userId)) }),
		db.query.reportDefinition.findFirst({ where: eq(reportDefinition.createdBy, userId) })
	]);
	return checks.some((row) => !!row);
}

/**
 * Instance-admin-only (see src/routes/admin/users). An org admin's equivalent is removing the
 * person from their org, which only affects that one org's membership — this is account-wide.
 *
 * - No history anywhere: the row (and its cascade-linked session/account/member/invitation rows)
 *   is actually deleted.
 * - Any history: deleting the row would either fail outright (several of those references are
 *   NOT NULL) or, if forced, blow a hole in other orgs' audit trail ("checked out by [nothing]").
 *   Anonymized instead — name/email scrubbed, login revoked, every org membership removed — so
 *   `activity_log`/`checkout`/etc. still resolve to a real (if now-nameless) row.
 */
export async function deleteUserAccount(
	userId: string,
	actorUserId: string,
	requestHeaders: Headers
): Promise<{ mode: 'deleted' | 'anonymized' }> {
	if (userId === actorUserId) {
		throw new Error("You can't delete your own account");
	}

	const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
	if (!target) throw new Error('User not found');

	const hasHistory = await userHasHistory(userId);

	if (!hasHistory) {
		// Goes through better-auth's own deletion lifecycle rather than a raw DELETE, same reason
		// ban/create/etc. already use auth.api.* elsewhere in this app.
		await auth.api.removeUser({ headers: requestHeaders, body: { userId } });
		return { mode: 'deleted' };
	}

	await db.transaction(async (tx) => {
		await tx
			.update(user)
			.set({
				name: 'Deleted user',
				email: `deleted-${userId}@deleted.invalid`,
				banned: true,
				banReason: 'Account deleted'
			})
			.where(eq(user.id, userId));
		await tx.delete(session).where(eq(session.userId, userId));
		await tx.delete(account).where(eq(account.userId, userId));
		await tx.delete(member).where(eq(member.userId, userId));
	});
	return { mode: 'anonymized' };
}
