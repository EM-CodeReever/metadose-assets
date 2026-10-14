import { error, fail, redirect } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { getObjectTypeBySlug } from '$lib/server/services/objectTypes';
import { fieldValueExists, getRecord, parseRecordFormValues, updateRecord } from '$lib/server/services/records';
import { listOrgUsers } from '$lib/server/services/members';
import { recalculateRemainingQuantity } from '$lib/server/services/checkouts';
import { listAllLookupValues } from '$lib/server/services/lookupValues';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const objectType = await getObjectTypeBySlug(organization.id, event.params.objectTypeSlug);
	if (!objectType) throw error(404, 'Object type not found');

	const record = await getRecord(organization.id, event.params.recordId);
	if (!record || record.objectTypeId !== objectType.id) throw error(404, 'Record not found');

	const [orgUsers, lookupValues] = await Promise.all([
		listOrgUsers(organization.id),
		listAllLookupValues(organization.id)
	]);
	return { organization, objectType, record, orgUsers, lookupValues };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(
			event,
			orgMembership,
			{ record: ['update'] },
			{ values: {} as Record<string, unknown> }
		);
		if (permissionError) return permissionError;

		const objectType = await getObjectTypeBySlug(orgMembership.organization.id, event.params.objectTypeSlug);
		if (!objectType) throw error(404, 'Object type not found');

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

		if (objectType.builtinKind === 'asset') {
			for (const key of ['assetTag', 'serialNumber'] as const) {
				const raw = values[key];
				if (typeof raw === 'string' && raw.trim()) {
					const duplicate = await fieldValueExists(
						orgMembership.organization.id,
						objectType.id,
						key,
						raw.trim(),
						event.params.recordId
					);
					if (duplicate) {
						const label = objectType.fields.find((f) => f.key === key)?.label ?? key;
						return fail(400, { message: `Another asset with that ${label.toLowerCase()} already exists`, values });
					}
				}
			}
		}

		await updateRecord({
			organizationId: orgMembership.organization.id,
			objectTypeId: objectType.id,
			recordId: event.params.recordId,
			values,
			updatedBy: user.id
		});
		await recalculateRemainingQuantity(orgMembership.organization.id, event.params.recordId);

		throw redirect(303, `/o/${event.params.orgSlug}/${event.params.objectTypeSlug}/${event.params.recordId}`);
	}
};
