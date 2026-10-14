import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { checkout, record, objectType, member, location, organization, lookupValue } from '$lib/server/db/schema';
import { logActivity } from './activityLog';
import { buildSlotsJson } from './records';
import { sendEmail } from '$lib/server/email';
import { getObjectType, type BuiltinKind } from './objectTypes';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

type AssignedToType = 'user' | 'location' | 'asset';

export interface KindRule {
	targetType: 'user_or_location' | 'user' | 'asset';
	quantityBased: boolean;
	allowCheckin: boolean;
	/** The field_definition key (in `record.data.values`) holding this record's total quantity —
	 *  meaningless when `quantityBased` is false. Always literally `'quantity'` for the three
	 *  built-in quantity kinds; for a custom 'bulk' type it's whatever field the admin designated
	 *  on the object type's settings page (e.g. `seats` on a "Software Licenses" type). */
	quantityFieldKey: string;
}

/**
 * How each built-in kind checks out, matching Snipe-IT: assets are single-unit and go to a
 * user or location; accessories/consumables/components are stock-quantity based. A custom type
 * picks one of these two shapes itself (see `objectType.trackingMode`/`quantityFieldKey`) instead
 * of being hardcoded — 'individual' behaves exactly like 'asset', 'bulk' exactly like 'accessory'
 * (quantity-based, checks back in, goes to a person — not the no-checkin consumable shape, and
 * not component's "installs into an asset" shape, neither of which a generic custom type implies).
 */
const KIND_RULES: Record<Exclude<BuiltinKind, 'custom'>, Omit<KindRule, 'quantityFieldKey'>> = {
	asset: { targetType: 'user_or_location', quantityBased: false, allowCheckin: true },
	accessory: { targetType: 'user', quantityBased: true, allowCheckin: true },
	consumable: { targetType: 'user', quantityBased: true, allowCheckin: false },
	component: { targetType: 'asset', quantityBased: true, allowCheckin: true }
};

export function rulesFor(objectType: {
	builtinKind: BuiltinKind;
	trackingMode?: 'individual' | 'bulk' | null;
	quantityFieldKey?: string | null;
}): KindRule {
	if (objectType.builtinKind !== 'custom') {
		return { ...KIND_RULES[objectType.builtinKind], quantityFieldKey: 'quantity' };
	}
	if (objectType.trackingMode === 'bulk') {
		return { ...KIND_RULES.accessory, quantityFieldKey: objectType.quantityFieldKey ?? 'quantity' };
	}
	return { ...KIND_RULES.asset, quantityFieldKey: 'quantity' };
}

/**
 * Whether a 'component' record can be installed into records of this type. Real assets have
 * always allowed it unconditionally; a custom individually-tracked type opts in via its own
 * `allowComponentInstall` flag (editable on its settings page) — bulk/quantity-based custom types
 * never qualify, same as accessory/consumable/component themselves don't.
 */
export function canInstallComponentsInto(objectType: {
	builtinKind: BuiltinKind;
	trackingMode?: 'individual' | 'bulk' | null;
	allowComponentInstall?: boolean;
}): boolean {
	if (objectType.builtinKind === 'asset') return true;
	return objectType.builtinKind === 'custom' && objectType.trackingMode !== 'bulk' && !!objectType.allowComponentInstall;
}

async function getRecordWithKind(organizationId: string, recordId: string) {
	const found = await db.query.record.findFirst({
		where: and(eq(record.organizationId, organizationId), eq(record.id, recordId), isNull(record.deletedAt)),
		with: { objectType: true }
	});
	if (!found) throw new Error('Record not found');
	return found;
}

export async function listOpenCheckoutsForRecord(organizationId: string, recordId: string) {
	return db.query.checkout.findMany({
		where: and(
			eq(checkout.organizationId, organizationId),
			eq(checkout.recordId, recordId),
			isNull(checkout.checkedInAt)
		),
		with: { assignedToUser: true, assignedToLocation: true, assignedToRecord: true, checkedOutByUser: true },
		orderBy: (c, { desc }) => desc(c.checkedOutAt)
	});
}

/** Convenience for asset-kind records, which only ever have 0 or 1 open checkout. */
export async function getCurrentCheckout(organizationId: string, recordId: string) {
	const open = await listOpenCheckoutsForRecord(organizationId, recordId);
	return open[0];
}

/** Batch version of getCurrentCheckout, for a record list's "Location"/"Assigned to" column. */
export async function getCurrentCheckoutsByRecordId(organizationId: string, recordIds: string[]) {
	if (recordIds.length === 0) return new Map<string, Awaited<ReturnType<typeof listOpenCheckoutsForRecord>>[number]>();

	const open = await db.query.checkout.findMany({
		where: and(
			eq(checkout.organizationId, organizationId),
			inArray(checkout.recordId, recordIds),
			isNull(checkout.checkedInAt)
		),
		with: { assignedToUser: true, assignedToLocation: true }
	});

	return new Map(open.map((c) => [c.recordId, c]));
}

async function sumOpenQuantity(tx: Tx, organizationId: string, recordId: string): Promise<number> {
	const [row] = await tx
		.select({ total: sql<number>`coalesce(sum(${checkout.quantity}), 0)` })
		.from(checkout)
		.where(
			and(eq(checkout.organizationId, organizationId), eq(checkout.recordId, recordId), isNull(checkout.checkedInAt))
		);
	return Number(row?.total ?? 0);
}

/**
 * For consumables (which never check back in) every open checkout is really a lifetime issuance,
 * so `total - sum(open quantities)` is exactly "remaining stock" — the same formula also happens
 * to be exactly "currently held" for accessories/components, which do check back in.
 */
export async function getAvailableQuantity(organizationId: string, recordId: string, totalQuantity: number) {
	const checkedOut = await sumOpenQuantity(db, organizationId, recordId);
	return Math.max(totalQuantity - checkedOut, 0);
}

async function writeRemainingQuantity(
	tx: Tx,
	organizationId: string,
	rec: Awaited<ReturnType<typeof getRecordWithKind>>,
	valuesOverride?: Record<string, unknown>
) {
	const values = valuesOverride ?? rec.data.values;
	const totalQuantity = Number(values.quantity) || 0;
	const checkedOut = await sumOpenQuantity(tx, organizationId, rec.id);
	const remaining = Math.max(totalQuantity - checkedOut, 0);

	const nextValues = { ...values, remainingQuantity: remaining };
	const nextSlots = await buildSlotsJson(rec.objectTypeId, nextValues);
	await tx.update(record).set({ data: { values: nextValues, slots: nextSlots } }).where(eq(record.id, rec.id));
}

/** Increments a consumable's total `quantity` (e.g. restocking) and recomputes `remainingQuantity`. */
export async function addConsumableStock(
	organizationId: string,
	recordId: string,
	amount: number,
	actorUserId: string
): Promise<void> {
	if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive amount to add');

	const rec = await getRecordWithKind(organizationId, recordId);
	if (rec.objectType.builtinKind !== 'consumable') throw new Error('Only consumables can have stock added');

	const nextQuantity = (Number(rec.data.values.quantity) || 0) + Math.floor(amount);

	await db.transaction(async (tx) => {
		await writeRemainingQuantity(tx, organizationId, rec, { ...rec.data.values, quantity: nextQuantity });
		await logActivity(tx, {
			organizationId,
			recordId,
			actorUserId,
			action: 'record.stock_added',
			summary: `Added ${Math.floor(amount)} to stock`
		});
	});
}

/**
 * Recomputes `remainingQuantity` for a consumable — call after creating/editing a consumable
 * record (e.g. its `quantity` changed) so `remaining` stays correct even outside of a checkout.
 * No-ops for every other kind.
 */
export async function recalculateRemainingQuantity(organizationId: string, recordId: string): Promise<void> {
	const rec = await getRecordWithKind(organizationId, recordId);
	if (rec.objectType.builtinKind !== 'consumable') return;
	await db.transaction((tx) => writeRemainingQuantity(tx, organizationId, rec));
}

function describeAssignment(type: AssignedToType, trackingLocation: boolean): string {
	if (type === 'user') return trackingLocation ? 'Checked out to a user at a location' : 'Checked out to a user';
	if (type === 'location') return 'Checked out to a location';
	return 'Installed into an asset';
}

export async function checkoutRecord(params: {
	organizationId: string;
	recordId: string;
	quantity?: number;
	assignedToType: AssignedToType;
	assignedToUserId?: string;
	assignedToLocationId?: string;
	assignedToRecordId?: string;
	dueAt?: Date;
	notes?: string;
	checkedOutBy: string;
}): Promise<void> {
	const rec = await getRecordWithKind(params.organizationId, params.recordId);
	const rules = rulesFor(rec.objectType);
	if (rules.quantityBased && rec.objectType.builtinKind === 'custom' && !rec.objectType.quantityFieldKey) {
		throw new Error('This object type has no quantity field configured yet — set one on its settings page');
	}

	if (rec.status === 'archived') throw new Error('This record is archived and cannot be checked out');

	if (params.quantity !== undefined && params.quantity <= 0) {
		throw new Error('Quantity must be at least 1');
	}
	const quantity = params.quantity ? Math.floor(params.quantity) : 1;

	if (rules.targetType === 'user_or_location') {
		if (params.assignedToType !== 'user' && params.assignedToType !== 'location') {
			throw new Error('Choose a user or location to check this out to');
		}
	} else if (params.assignedToType !== rules.targetType) {
		throw new Error(rules.targetType === 'asset' ? 'Choose an asset to install this into' : 'Choose a user');
	}
	// For 'user_or_location' kinds (assets), a location tracks physical whereabouts even when
	// the asset is assigned to a person — a plain 'location' checkout already IS the tracked
	// location, so it doesn't need a second one.
	const needsTrackingLocation = params.assignedToType === 'user' && rules.targetType === 'user_or_location';

	if (params.assignedToType === 'user') {
		if (!params.assignedToUserId) throw new Error('Select a user');
		const membership = await db.query.member.findFirst({
			where: and(eq(member.organizationId, params.organizationId), eq(member.userId, params.assignedToUserId)),
			with: { user: true }
		});
		if (!membership) throw new Error('That user is not a member of this organization');
		// Instance super-admins are system administrators, not operational participants — they
		// never hold assets/accessories/consumables/components, so they never appear as a
		// checkout recipient regardless of how this call was reached (direct checkout, new-record
		// assignment, or request approval).
		if (membership.user.role === 'super_admin') {
			throw new Error('Instance admin accounts cannot be assigned a checkout');
		}
	}
	if (params.assignedToType === 'location' || needsTrackingLocation) {
		if (!params.assignedToLocationId) throw new Error('Select a location');
		const loc = await db.query.location.findFirst({
			where: and(eq(location.organizationId, params.organizationId), eq(location.id, params.assignedToLocationId))
		});
		if (!loc) throw new Error('That location does not belong to this organization');
	}
	if (params.assignedToType === 'asset') {
		if (!params.assignedToRecordId) throw new Error('Select an asset');
		const target = await getRecordWithKind(params.organizationId, params.assignedToRecordId);
		if (!canInstallComponentsInto(target.objectType)) {
			throw new Error('Components cannot be installed into this type of record');
		}
	}

	if (!rules.quantityBased) {
		const existing = await getCurrentCheckout(params.organizationId, params.recordId);
		if (existing) throw new Error('This record is already checked out');
	} else {
		const totalQuantity = Number(rec.data.values[rules.quantityFieldKey]) || 0;
		const available = await getAvailableQuantity(params.organizationId, params.recordId, totalQuantity);
		if (quantity > available) throw new Error(`Only ${available} available`);
	}

	await db.transaction(async (tx) => {
		await tx.insert(checkout).values({
			id: randomUUID(),
			organizationId: params.organizationId,
			recordId: params.recordId,
			quantity,
			assignedToType: params.assignedToType,
			assignedToUserId: params.assignedToType === 'user' ? params.assignedToUserId : null,
			assignedToLocationId:
				params.assignedToType === 'location' || needsTrackingLocation ? params.assignedToLocationId : null,
			assignedToRecordId: params.assignedToType === 'asset' ? params.assignedToRecordId : null,
			checkedOutBy: params.checkedOutBy,
			dueAt: params.dueAt,
			notes: params.notes
		});

		if (!rules.quantityBased) {
			await tx
				.update(record)
				.set({ status: 'checked_out', updatedBy: params.checkedOutBy })
				.where(and(eq(record.id, params.recordId), eq(record.organizationId, params.organizationId)));
		}
		if (rec.objectType.builtinKind === 'consumable') {
			await writeRemainingQuantity(tx, params.organizationId, rec);
		}

		await logActivity(tx, {
			organizationId: params.organizationId,
			recordId: params.recordId,
			actorUserId: params.checkedOutBy,
			action: 'record.checked_out',
			summary: describeAssignment(params.assignedToType, needsTrackingLocation)
		});
	});
}

/**
 * Resolves everything needed to split some quantity off into a different condition: the type's
 * condition field, the target condition row, and an existing sibling record to accumulate into
 * if one already matches (same type, same field values except quantity/condition) — so repeated
 * splits grow one pool instead of spawning a new record every time.
 */
async function resolveConditionSplitContext(params: {
	organizationId: string;
	objectTypeId: string;
	currentValues: Record<string, unknown>;
	targetConditionId: string;
	quantityFieldKey: string;
}) {
	const fullObjectType = await getObjectType(params.organizationId, params.objectTypeId);
	if (!fullObjectType) throw new Error('Object type not found');
	const conditionField = fullObjectType.fields.find((f) => f.dataType === 'reference' && f.referenceKind === 'condition');
	if (!conditionField) throw new Error('This type has no condition field to split by');

	const targetCondition = await db.query.lookupValue.findFirst({
		where: and(
			eq(lookupValue.organizationId, params.organizationId),
			eq(lookupValue.id, params.targetConditionId),
			eq(lookupValue.kind, 'condition')
		)
	});
	if (!targetCondition) throw new Error('Condition not found');
	if (params.currentValues[conditionField.key] === params.targetConditionId) {
		throw new Error("That is already this record's current condition");
	}

	const candidates = await db.query.record.findMany({
		where: and(eq(record.organizationId, params.organizationId), eq(record.objectTypeId, params.objectTypeId), isNull(record.deletedAt))
	});
	const matchKeys = Object.keys(params.currentValues).filter(
		(k) => k !== conditionField.key && k !== params.quantityFieldKey && k !== 'remainingQuantity'
	);
	const sibling = candidates.find(
		(s) =>
			s.data.values[conditionField.key] === params.targetConditionId &&
			matchKeys.every((k) => s.data.values[k] === params.currentValues[k])
	);

	return { conditionField, targetCondition, sibling };
}

/**
 * Checks in some or all of an open checkout's quantity, optionally reporting that some of what's
 * returning is in a different condition than the record's current one.
 *
 * - `checkinQuantity` (default: the checkout's full remaining quantity) is how many units are
 *   being returned right now. Less than the full amount leaves the checkout open with its
 *   quantity reduced by that much — e.g. 1 of 3 mice returned, 2 stay checked out to the same
 *   person. Only quantity-based kinds (accessory/component) support a partial amount; assets
 *   always check in whole.
 * - `splitQuantity` (default 0, must be <= checkinQuantity) is how many of THOSE returning units
 *   move into a sibling record tracking `targetConditionId` instead of going back to this
 *   record's own pool unchanged. If that condition is flagged `outOfService`, the sibling is
 *   automatically taken out of circulation.
 */
export async function checkinRecord(params: {
	organizationId: string;
	checkoutId: string;
	checkedInBy: string;
	checkinQuantity?: number;
	splitQuantity?: number;
	targetConditionId?: string;
}): Promise<void> {
	const existing = await db.query.checkout.findFirst({
		where: and(
			eq(checkout.organizationId, params.organizationId),
			eq(checkout.id, params.checkoutId),
			isNull(checkout.checkedInAt)
		)
	});
	if (!existing) throw new Error('This checkout is not currently open');

	const rec = await getRecordWithKind(params.organizationId, existing.recordId);
	const rules = rulesFor(rec.objectType);
	if (!rules.allowCheckin) throw new Error('This cannot be checked back in');

	const checkinQuantity = params.checkinQuantity ?? existing.quantity;
	if (!Number.isFinite(checkinQuantity) || checkinQuantity <= 0 || checkinQuantity > existing.quantity) {
		throw new Error(`Enter a quantity between 1 and ${existing.quantity}`);
	}
	if (!rules.quantityBased && checkinQuantity !== existing.quantity) {
		throw new Error('This cannot be partially checked in');
	}

	const splitQuantity = params.splitQuantity ?? 0;
	if (splitQuantity < 0 || splitQuantity > checkinQuantity) {
		throw new Error(`The condition-change quantity can't exceed the ${checkinQuantity} being checked in`);
	}
	if (splitQuantity > 0) {
		if (!params.targetConditionId) throw new Error('Choose a condition for the split-off units');
		if (!rules.quantityBased) throw new Error('Condition splitting only applies to quantity-based kinds');
	}

	const splitContext =
		splitQuantity > 0 && params.targetConditionId
			? await resolveConditionSplitContext({
					organizationId: params.organizationId,
					objectTypeId: rec.objectTypeId,
					currentValues: rec.data.values,
					targetConditionId: params.targetConditionId,
					quantityFieldKey: rules.quantityFieldKey
				})
			: undefined;

	const isFullCheckin = checkinQuantity === existing.quantity;

	await db.transaction(async (tx) => {
		if (isFullCheckin) {
			await tx
				.update(checkout)
				.set({ checkedInAt: new Date(), checkedInBy: params.checkedInBy })
				.where(eq(checkout.id, existing.id));

			if (!rules.quantityBased) {
				await tx
					.update(record)
					.set({ status: 'available', updatedBy: params.checkedInBy })
					.where(and(eq(record.id, rec.id), eq(record.organizationId, params.organizationId)));
			}
		} else {
			// Partial return: this checkout stays open, now representing however many units this
			// person still holds from it.
			await tx.update(checkout).set({ quantity: existing.quantity - checkinQuantity }).where(eq(checkout.id, existing.id));
		}

		if (splitContext) {
			const { conditionField, targetCondition, sibling } = splitContext;
			const qtyKey = rules.quantityFieldKey;

			const originalQuantity = Number(rec.data.values[qtyKey]) || 0;
			const nextOriginalValues = { ...rec.data.values, [qtyKey]: originalQuantity - splitQuantity };
			const originalSlots = await buildSlotsJson(rec.objectTypeId, nextOriginalValues);
			await tx
				.update(record)
				.set({ data: { values: nextOriginalValues, slots: originalSlots }, updatedBy: params.checkedInBy })
				.where(eq(record.id, rec.id));

			let siblingRecordId: string;
			if (sibling) {
				const siblingQuantity = Number(sibling.data.values[qtyKey]) || 0;
				const nextSiblingValues = { ...sibling.data.values, [qtyKey]: siblingQuantity + splitQuantity };
				const siblingSlots = await buildSlotsJson(rec.objectTypeId, nextSiblingValues);
				await tx
					.update(record)
					.set({ data: { values: nextSiblingValues, slots: siblingSlots }, updatedBy: params.checkedInBy })
					.where(eq(record.id, sibling.id));
				siblingRecordId = sibling.id;
			} else {
				siblingRecordId = randomUUID();
				const newValues = { ...rec.data.values, [qtyKey]: splitQuantity, [conditionField.key]: params.targetConditionId };
				const newSlots = await buildSlotsJson(rec.objectTypeId, newValues);
				await tx.insert(record).values({
					id: siblingRecordId,
					organizationId: params.organizationId,
					objectTypeId: rec.objectTypeId,
					data: { values: newValues, slots: newSlots },
					createdBy: params.checkedInBy,
					updatedBy: params.checkedInBy
				});
			}

			if (targetCondition.outOfService) {
				await tx
					.update(record)
					.set({ requestableOverride: false, updatedBy: params.checkedInBy })
					.where(eq(record.id, siblingRecordId));
			}

			await logActivity(tx, {
				organizationId: params.organizationId,
				recordId: rec.id,
				actorUserId: params.checkedInBy,
				action: 'record.condition_split_out',
				summary: `${splitQuantity} unit(s) checked in to a different condition (${targetCondition.name})`
			});
			await logActivity(tx, {
				organizationId: params.organizationId,
				recordId: siblingRecordId,
				actorUserId: params.checkedInBy,
				action: 'record.condition_split_in',
				summary: `${splitQuantity} unit(s) received from a check-in condition change`
			});
		}

		await logActivity(tx, {
			organizationId: params.organizationId,
			recordId: rec.id,
			actorUserId: params.checkedInBy,
			action: 'record.checked_in',
			summary: isFullCheckin ? undefined : `${checkinQuantity} of ${existing.quantity} unit(s) checked in`
		});
	});
}

/** A user's own open checkouts across the org — the member dashboard's "confirm receipt" list. */
export async function listMyOpenCheckouts(organizationId: string, userId: string) {
	return db.query.checkout.findMany({
		where: and(
			eq(checkout.organizationId, organizationId),
			eq(checkout.assignedToUserId, userId),
			isNull(checkout.checkedInAt)
		),
		with: { record: { with: { objectType: true } }, assignedToLocation: true },
		orderBy: (c, { desc }) => desc(c.checkedOutAt)
	});
}

/** Full checkout history (open + checked-in) for one user in one org — the org-side Users page's "assigned to them" and "history" tabs. */
export async function listCheckoutsForUser(organizationId: string, userId: string) {
	return db.query.checkout.findMany({
		where: and(eq(checkout.organizationId, organizationId), eq(checkout.assignedToUserId, userId)),
		with: { record: { with: { objectType: true } }, assignedToLocation: true, checkedOutByUser: true, checkedInByUser: true },
		orderBy: (c, { desc }) => desc(c.checkedOutAt)
	});
}

/**
 * The assignee's own one-click acknowledgment that they've received a checked-out item —
 * distinct from check-in. Only the person it's assigned to may accept it.
 */
export async function acceptCheckout(organizationId: string, checkoutId: string, userId: string): Promise<void> {
	const existing = await db.query.checkout.findFirst({
		where: and(
			eq(checkout.organizationId, organizationId),
			eq(checkout.id, checkoutId),
			isNull(checkout.checkedInAt)
		)
	});
	if (!existing) throw new Error('This checkout is not currently open');
	if (existing.assignedToUserId !== userId) throw new Error('This is not assigned to you');
	if (existing.acceptedAt) return;

	await db.transaction(async (tx) => {
		await tx.update(checkout).set({ acceptedAt: new Date() }).where(eq(checkout.id, existing.id));
		await logActivity(tx, {
			organizationId,
			recordId: existing.recordId,
			actorUserId: userId,
			action: 'record.accepted'
		});
	});
}

/** Emails the assignee a nudge to confirm receipt of a checkout that's still awaiting it. */
export async function sendAcceptanceReminder(organizationId: string, checkoutId: string, actorUserId: string): Promise<void> {
	const existing = await db.query.checkout.findFirst({
		where: and(eq(checkout.organizationId, organizationId), eq(checkout.id, checkoutId), isNull(checkout.checkedInAt)),
		with: { assignedToUser: true, record: { with: { objectType: true } } }
	});
	if (!existing) throw new Error('This checkout is not currently open');
	if (!existing.assignedToUserId || !existing.assignedToUser) {
		throw new Error('This checkout has no assigned user to remind');
	}
	if (existing.acceptedAt) throw new Error('Receipt has already been confirmed for this checkout');

	const org = await db.query.organization.findFirst({ where: eq(organization.id, organizationId) });
	const recordName = String(existing.record.data.values.name ?? existing.record.objectType.name);
	const link = `${env.ORIGIN ?? ''}/o/${org?.slug}/${existing.record.objectType.slug}/${existing.record.id}`;

	await sendEmail({
		to: existing.assignedToUser.email,
		subject: `Reminder: confirm receipt of ${recordName}`,
		html: `<p><strong>${recordName}</strong> was checked out to you and is still awaiting your confirmation of receipt.</p><p><a href="${link}">View it and confirm receipt</a></p>`
	});

	await logActivity(db, {
		organizationId,
		recordId: existing.recordId,
		actorUserId,
		action: 'record.reminder_sent'
	});
}

export async function listOpenCheckouts(organizationId: string) {
	return db.query.checkout.findMany({
		where: and(eq(checkout.organizationId, organizationId), isNull(checkout.checkedInAt)),
		with: {
			record: { with: { objectType: true } },
			assignedToUser: true,
			assignedToLocation: true,
			assignedToRecord: true,
			checkedOutByUser: true
		},
		orderBy: (c, { asc }) => asc(c.dueAt)
	});
}

/** Asset-kind records in the org, for the "install component into an asset" picker. */
/** Real assets, plus any custom individually-tracked type that's opted into accepting installs. */
async function listComponentInstallTargetTypes(organizationId: string) {
	const types = await db.query.objectType.findMany({
		where: and(eq(objectType.organizationId, organizationId), eq(objectType.isArchived, false))
	});
	return types.filter((t) => canInstallComponentsInto(t));
}

export async function listAssetRecordsForPicker(organizationId: string) {
	const targetTypes = await listComponentInstallTargetTypes(organizationId);
	if (targetTypes.length === 0) return [];

	return db.query.record.findMany({
		where: and(
			eq(record.organizationId, organizationId),
			inArray(record.objectTypeId, targetTypes.map((t) => t.id)),
			isNull(record.deletedAt)
		),
		with: { objectType: true }
	});
}

/** The component records currently installed into one asset-like record (open checkouts targeting it). */
export async function listInstalledComponents(organizationId: string, assetRecordId: string) {
	return db.query.checkout.findMany({
		where: and(
			eq(checkout.organizationId, organizationId),
			eq(checkout.assignedToType, 'asset'),
			eq(checkout.assignedToRecordId, assetRecordId),
			isNull(checkout.checkedInAt)
		),
		with: { record: { with: { objectType: true } } },
		orderBy: (c, { desc }) => desc(c.checkedOutAt)
	});
}
