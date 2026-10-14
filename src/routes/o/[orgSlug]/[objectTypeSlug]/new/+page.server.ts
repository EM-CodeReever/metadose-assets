import { error, fail, redirect } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { getObjectTypeBySlug } from '$lib/server/services/objectTypes';
import { createRecord, fieldValueExists, parseRecordFormValues, setRecordImage } from '$lib/server/services/records';
import { listOrgUsers } from '$lib/server/services/members';
import { checkoutRecord, recalculateRemainingQuantity, rulesFor } from '$lib/server/services/checkouts';
import { listLocations } from '$lib/server/services/locations';
import { listAllLookupValues } from '$lib/server/services/lookupValues';
import { uploadAttachment } from '$lib/server/services/attachments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const objectType = await getObjectTypeBySlug(organization.id, event.params.objectTypeSlug);
	if (!objectType) throw error(404, 'Object type not found');

	const [orgUsers, lookupValues, locations] = await Promise.all([
		listOrgUsers(organization.id),
		listAllLookupValues(organization.id),
		listLocations(organization.id)
	]);
	return { organization, objectType, rules: rulesFor(objectType), orgUsers, lookupValues, locations };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(
			event,
			orgMembership,
			{ record: ['create'] },
			{ values: {} as Record<string, unknown> }
		);
		if (permissionError) return permissionError;

		const objectType = await getObjectTypeBySlug(orgMembership.organization.id, event.params.objectTypeSlug);
		if (!objectType) throw error(404, 'Object type not found');

		// systemManaged fields (e.g. a consumable's remainingQuantity) have no form control —
		// their value is always computed, never submitted.
		const editableFields = objectType.fields.filter((f) => !f.systemManaged);

		const formData = await event.request.formData();
		const { values, missingRequired } = parseRecordFormValues(editableFields, formData);
		if (missingRequired.length > 0) {
			return fail(400, {
				message: `${missingRequired.join(', ')} ${missingRequired.length === 1 ? 'is' : 'are'} required`,
				values
			});
		}

		if (objectType.builtinKind === 'consumable' && Number(values.minQuantity) < 1) {
			return fail(400, { message: 'Minimum quantity must be at least 1', values });
		}

		let assignedToUserId: string | undefined;
		let assignedToLocationId: string | undefined;
		let assignMode: 'none' | 'user' | 'location' = 'none';
		let defaultLocationId: string | undefined;

		if (rulesFor(objectType).targetType === 'user_or_location') {
			for (const key of ['assetTag', 'serialNumber'] as const) {
				const raw = values[key];
				if (typeof raw === 'string' && raw.trim()) {
					const duplicate = await fieldValueExists(orgMembership.organization.id, objectType.id, key, raw.trim());
					if (duplicate) {
						const label = objectType.fields.find((f) => f.key === key)?.label ?? key;
						return fail(400, { message: `Another asset with that ${label.toLowerCase()} already exists`, values });
					}
				}
			}

			const requestedMode = formData.get('assignMode')?.toString();
			assignMode = requestedMode === 'user' || requestedMode === 'location' ? requestedMode : 'none';

			if (assignMode === 'user') {
				assignedToUserId = formData.get('assignedToUserId')?.toString() || undefined;
				assignedToLocationId = formData.get('assignedToLocationId')?.toString() || undefined;
				if (!assignedToUserId || !assignedToLocationId) {
					const echoedValues: Record<string, unknown> = { ...values, assignMode };
					return fail(400, {
						message: 'Choose who this asset is checked out to and where it is',
						values: echoedValues
					});
				}
			} else if (assignMode === 'location') {
				assignedToLocationId = formData.get('locationOnlyId')?.toString() || undefined;
				if (!assignedToLocationId) {
					const echoedValues: Record<string, unknown> = { ...values, assignMode };
					return fail(400, { message: 'Choose a location', values: echoedValues });
				}
			} else {
				defaultLocationId = formData.get('defaultLocationId')?.toString() || undefined;
			}
		}

		const recordId = await createRecord({
			organizationId: orgMembership.organization.id,
			objectTypeId: objectType.id,
			values,
			createdBy: user.id,
			defaultLocationId
		});
		await recalculateRemainingQuantity(orgMembership.organization.id, recordId);

		// Importing an already-assigned asset: pick a user (and its tracked location), or a bare
		// location, right on the create form instead of creating it and checking it out after.
		if (assignMode === 'user' && assignedToUserId && assignedToLocationId) {
			await checkoutRecord({
				organizationId: orgMembership.organization.id,
				recordId,
				assignedToType: 'user',
				assignedToUserId,
				assignedToLocationId,
				checkedOutBy: user.id
			});
		} else if (assignMode === 'location' && assignedToLocationId) {
			await checkoutRecord({
				organizationId: orgMembership.organization.id,
				recordId,
				assignedToType: 'location',
				assignedToLocationId,
				checkedOutBy: user.id
			});
		}

		// The record (and any checkout) already exists by this point — failing the whole action
		// over a rejected image/attachment (bad type, too large) would strand the user on this
		// form while a record they just created sits elsewhere, so both are best-effort.
		const image = formData.get('image');
		if (image instanceof File && image.size > 0) {
			await setRecordImage({ organizationId: orgMembership.organization.id, recordId, file: image, actorUserId: user.id }).catch(
				() => {}
			);
		}

		const attachments = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0);
		for (const file of attachments) {
			await uploadAttachment({ organizationId: orgMembership.organization.id, recordId, file, uploadedBy: user.id }).catch(() => {});
		}

		throw redirect(303, `/o/${event.params.orgSlug}/${event.params.objectTypeSlug}/${recordId}`);
	}
};
