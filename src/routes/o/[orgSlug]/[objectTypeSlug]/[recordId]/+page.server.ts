import { error, fail, redirect } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { getObjectTypeBySlug } from '$lib/server/services/objectTypes';
import {
	archiveRecord,
	getRecord,
	removeRecordImage,
	setRecordImage,
	setRecordRequestableOverride,
	softDeleteRecord,
	unarchiveRecord
} from '$lib/server/services/records';
import { listOrgUsers } from '$lib/server/services/members';
import { listLocations } from '$lib/server/services/locations';
import {
	acceptCheckout,
	addConsumableStock,
	canInstallComponentsInto,
	checkinRecord,
	checkoutRecord,
	getAvailableQuantity,
	listAssetRecordsForPicker,
	listInstalledComponents,
	listOpenCheckoutsForRecord,
	rulesFor,
	sendAcceptanceReminder
} from '$lib/server/services/checkouts';
import { createCheckoutRequest, listMyCheckoutRequests } from '$lib/server/services/checkoutRequests';
import { listActivityForRecord } from '$lib/server/services/activityLog';
import { deleteAttachment, listAttachments, uploadAttachment } from '$lib/server/services/attachments';
import { listAllLookupValues } from '$lib/server/services/lookupValues';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization, membership, user, timezone } = await event.parent();
	const objectType = await getObjectTypeBySlug(organization.id, event.params.objectTypeSlug);
	if (!objectType) throw error(404, 'Object type not found');

	const record = await getRecord(organization.id, event.params.recordId);
	if (!record || record.objectTypeId !== objectType.id) throw error(404, 'Record not found');

	const rules = rulesFor(objectType);
	const canHoldComponents = canInstallComponentsInto(objectType);

	const [orgUsers, locations, openCheckouts, activity, attachments, assetOptions, lookupValues, installedComponents] =
		await Promise.all([
			listOrgUsers(organization.id),
			listLocations(organization.id),
			listOpenCheckoutsForRecord(organization.id, record.id),
			listActivityForRecord(organization.id, record.id),
			listAttachments(organization.id, record.id),
			objectType.builtinKind === 'component' ? listAssetRecordsForPicker(organization.id) : Promise.resolve([]),
			listAllLookupValues(organization.id),
			canHoldComponents ? listInstalledComponents(organization.id, record.id) : Promise.resolve([])
		]);

	const availableQuantity = rules.quantityBased
		? await getAvailableQuantity(organization.id, record.id, Number(record.data.values[rules.quantityFieldKey]) || 0)
		: null;

	const hasPendingRequest =
		membership?.role === 'member'
			? (await listMyCheckoutRequests(organization.id, user.id)).some(
					(r) => r.recordId === record.id && r.status === 'pending'
				)
			: false;

	return {
		organization,
		membership,
		user,
		timezone,
		objectType,
		record,
		rules,
		canHoldComponents,
		orgUsers,
		locations,
		openCheckouts,
		activity,
		attachments,
		assetOptions,
		availableQuantity,
		lookupValues,
		installedComponents,
		hasPendingRequest
	};
};

export const actions: Actions = {
	delete: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['delete'] });
		if (permissionError) return permissionError;

		await softDeleteRecord(orgMembership.organization.id, event.params.recordId, user.id);
		throw redirect(303, `/o/${event.params.orgSlug}/${event.params.objectTypeSlug}`);
	},

	archive: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['update'] });
		if (permissionError) return permissionError;

		try {
			await archiveRecord(orgMembership.organization.id, event.params.recordId, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not archive record' });
		}

		return { success: true };
	},

	unarchive: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['update'] });
		if (permissionError) return permissionError;

		await unarchiveRecord(orgMembership.organization.id, event.params.recordId, user.id);
		return { success: true };
	},

	checkout: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['checkout'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const assignedToType = formData.get('assignedToType')?.toString();
		const assignedToUserId = formData.get('assignedToUserId')?.toString() || undefined;
		const assignedToLocationId = formData.get('assignedToLocationId')?.toString() || undefined;
		const assignedToRecordId = formData.get('assignedToRecordId')?.toString() || undefined;
		const quantityRaw = formData.get('quantity')?.toString();
		const dueAtRaw = formData.get('dueAt')?.toString();
		const notes = formData.get('notes')?.toString().trim() || undefined;

		if (assignedToType !== 'user' && assignedToType !== 'location' && assignedToType !== 'asset') {
			return fail(400, { message: 'Choose who or where this is checked out to' });
		}

		let dueAt: Date | undefined;
		if (dueAtRaw) {
			dueAt = new Date(dueAtRaw);
			if (Number.isNaN(dueAt.getTime())) {
				return fail(400, { message: 'Enter a valid due date' });
			}
		}

		try {
			await checkoutRecord({
				organizationId: orgMembership.organization.id,
				recordId: event.params.recordId,
				quantity: quantityRaw ? Number(quantityRaw) : undefined,
				assignedToType,
				assignedToUserId,
				assignedToLocationId,
				assignedToRecordId,
				dueAt,
				notes,
				checkedOutBy: user.id
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not check out record' });
		}

		return { success: true };
	},

	addStock: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['update'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const amount = Number(formData.get('amount'));

		try {
			await addConsumableStock(orgMembership.organization.id, event.params.recordId, amount, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not add stock' });
		}

		return { success: true };
	},

	checkin: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['checkin'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const checkoutId = formData.get('checkoutId')?.toString();
		if (!checkoutId) return fail(400, { message: 'Missing checkout' });

		try {
			await checkinRecord({
				organizationId: orgMembership.organization.id,
				checkoutId,
				checkedInBy: user.id
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not check in record' });
		}

		return { success: true };
	},

	checkinDetailed: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['checkin'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const checkoutId = formData.get('checkoutId')?.toString();
		if (!checkoutId) return fail(400, { message: 'Missing checkout' });

		const checkinQuantityRaw = formData.get('checkinQuantity')?.toString();
		const splitQuantityRaw = formData.get('splitQuantity')?.toString();
		const targetConditionId = formData.get('targetConditionId')?.toString() || undefined;

		try {
			await checkinRecord({
				organizationId: orgMembership.organization.id,
				checkoutId,
				checkedInBy: user.id,
				checkinQuantity: checkinQuantityRaw ? Number(checkinQuantityRaw) : undefined,
				splitQuantity: splitQuantityRaw ? Number(splitQuantityRaw) : undefined,
				targetConditionId
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not check in' });
		}

		return { success: true };
	},

	uploadAttachment: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { attachment: ['create'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Choose a file to upload' });
		}

		try {
			await uploadAttachment({
				organizationId: orgMembership.organization.id,
				recordId: event.params.recordId,
				file,
				uploadedBy: user.id
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not upload file' });
		}

		return { success: true };
	},

	deleteAttachment: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { attachment: ['delete'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const attachmentId = formData.get('attachmentId')?.toString();
		if (!attachmentId) return fail(400, { message: 'Missing attachment' });

		await deleteAttachment(orgMembership.organization.id, attachmentId, user.id);
		return { success: true };
	},

	uploadImage: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['update'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const file = formData.get('image');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Choose an image to upload' });
		}

		try {
			await setRecordImage({
				organizationId: orgMembership.organization.id,
				recordId: event.params.recordId,
				file,
				actorUserId: user.id
			});
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not upload image' });
		}

		return { success: true };
	},

	removeImage: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['update'] });
		if (permissionError) return permissionError;

		await removeRecordImage(orgMembership.organization.id, event.params.recordId, user.id);
		return { success: true };
	},

	setRequestable: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['update'] });
		if (permissionError) return permissionError;

		const raw = (await event.request.formData()).get('requestableOverride')?.toString();
		const override = raw === 'true' ? true : raw === 'false' ? false : null;

		await setRecordRequestableOverride(orgMembership.organization.id, event.params.recordId, override, user.id);
		return { success: true };
	},

	accept: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);

		const formData = await event.request.formData();
		const checkoutId = formData.get('checkoutId')?.toString();
		if (!checkoutId) return fail(400, { message: 'Missing checkout' });

		try {
			await acceptCheckout(orgMembership.organization.id, checkoutId, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not confirm receipt' });
		}

		return { success: true };
	},

	sendReminder: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { record: ['update'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const checkoutId = formData.get('checkoutId')?.toString();
		if (!checkoutId) return fail(400, { message: 'Missing checkout' });

		try {
			await sendAcceptanceReminder(orgMembership.organization.id, checkoutId, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not send reminder' });
		}

		return { success: true, reminderSent: true };
	},

	request: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { checkoutRequest: ['create'] });
		if (permissionError) return permissionError;

		try {
			await createCheckoutRequest(orgMembership.organization.id, event.params.recordId, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not submit request' });
		}

		return { success: true, requested: true };
	}
};
