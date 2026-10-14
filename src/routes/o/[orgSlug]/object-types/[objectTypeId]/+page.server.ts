import { error, fail } from '@sveltejs/kit';
import { requireOrgPermissionOrFail, requireUser, resolveOrgMembership } from '$lib/server/authz';
import { getObjectType, setObjectTypeArchived, updateObjectType } from '$lib/server/services/objectTypes';
import {
	FIELD_DATA_TYPES,
	createFieldDefinition,
	deleteFieldDefinition,
	moveFieldDefinition,
	parseSelectOptionsInput,
	toggleFilterable,
	toggleReportable,
	updateFieldDefinition,
	type FieldDataType
} from '$lib/server/services/fieldDefinitions';
import { SlotExhaustedError } from '$lib/server/services/slotAllocator';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const objectType = await getObjectType(organization.id, event.params.objectTypeId);
	if (!objectType) throw error(404, 'Object type not found');
	return { objectType };
};

export const actions: Actions = {
	updateSettings: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['update'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const description = formData.get('description')?.toString().trim();
		const barcodeFieldKeys = formData.getAll('barcodeFieldKeys').map(String);
		const requestable = formData.get('requestable') === 'on';
		const quantityFieldKeyInput = formData.get('quantityFieldKey')?.toString();
		const allowComponentInstall = formData.get('allowComponentInstall') === 'on';

		if (!name) return fail(400, { message: 'Name is required' });
		if (barcodeFieldKeys.length > 3) return fail(400, { message: 'Choose up to 3 label fields' });

		const objectType = await getObjectType(orgMembership.organization.id, event.params.objectTypeId);
		if (!objectType) throw error(404, 'Object type not found');

		const validKeys = new Set(
			objectType.fields.filter((f) => f.dataType === 'text' || f.dataType === 'number').map((f) => f.key)
		);
		const filteredKeys = barcodeFieldKeys.filter((k) => validKeys.has(k));

		const isBulkCustomType = objectType.builtinKind === 'custom' && objectType.trackingMode === 'bulk';
		const isIndividualCustomType = objectType.builtinKind === 'custom' && objectType.trackingMode === 'individual';
		const validNumberKeys = new Set(objectType.fields.filter((f) => f.dataType === 'number').map((f) => f.key));
		const quantityFieldKey =
			isBulkCustomType && quantityFieldKeyInput && validNumberKeys.has(quantityFieldKeyInput)
				? quantityFieldKeyInput
				: objectType.quantityFieldKey;

		await updateObjectType(
			orgMembership.organization.id,
			event.params.objectTypeId,
			{
				name,
				description: description || null,
				barcodeFieldKeys: filteredKeys.length > 0 ? filteredKeys : null,
				requestable: objectType.builtinKind === 'component' ? objectType.requestable : requestable,
				...(isBulkCustomType ? { quantityFieldKey } : {}),
				...(isIndividualCustomType ? { allowComponentInstall } : {})
			},
			user.id
		);
		return { success: true };
	},

	setArchived: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['archive'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const archived = formData.get('archived') === 'true';
		try {
			await setObjectTypeArchived(orgMembership.organization.id, event.params.objectTypeId, archived, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not update object type' });
		}
		return { success: true };
	},

	addField: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const label = formData.get('label')?.toString().trim() ?? '';
		const dataType = formData.get('dataType')?.toString();
		const required = formData.get('required') === 'on';
		const selectOptions = parseSelectOptionsInput(formData.get('selectOptions')?.toString() ?? '');

		if (!label) return fail(400, { message: 'Label is required' });
		if (!dataType || !(FIELD_DATA_TYPES as readonly string[]).includes(dataType)) {
			return fail(400, { message: 'Invalid field type' });
		}
		if (dataType === 'select' && selectOptions.length === 0) {
			return fail(400, { message: 'Add at least one option for a select field' });
		}

		await createFieldDefinition({
			organizationId: orgMembership.organization.id,
			objectTypeId: event.params.objectTypeId,
			label,
			dataType: dataType as FieldDataType,
			required,
			selectOptions,
			actorUserId: user.id
		});
		return { success: true };
	},

	updateField: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const fieldId = formData.get('fieldId')?.toString();
		const label = formData.get('label')?.toString().trim() ?? '';
		const required = formData.get('required') === 'on';
		const selectOptions = parseSelectOptionsInput(formData.get('selectOptions')?.toString() ?? '');

		if (!fieldId) return fail(400, { message: 'Missing field' });
		if (!label) return fail(400, { message: 'Label is required' });

		await updateFieldDefinition(fieldId, { label, required, selectOptions }, user.id);
		return { success: true };
	},

	deleteField: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const fieldId = formData.get('fieldId')?.toString();
		if (!fieldId) return fail(400, { message: 'Missing field' });

		try {
			await deleteFieldDefinition(fieldId, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not delete field' });
		}
		return { success: true };
	},

	toggleFilterable: async (event) => {
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const fieldId = formData.get('fieldId')?.toString();
		const next = formData.get('next') === 'true';
		if (!fieldId) return fail(400, { message: 'Missing field' });

		try {
			await toggleFilterable(fieldId, next);
		} catch (err) {
			if (err instanceof SlotExhaustedError) return fail(400, { message: err.message });
			throw err;
		}
		return { success: true };
	},

	toggleReportable: async (event) => {
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const fieldId = formData.get('fieldId')?.toString();
		const next = formData.get('next') === 'true';
		if (!fieldId) return fail(400, { message: 'Missing field' });

		try {
			await toggleReportable(fieldId, next);
		} catch (err) {
			if (err instanceof SlotExhaustedError) return fail(400, { message: err.message });
			throw err;
		}
		return { success: true };
	},

	moveField: async (event) => {
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);
		const permissionError = await requireOrgPermissionOrFail(event, orgMembership, { objectType: ['manage_fields'] });
		if (permissionError) return permissionError;

		const formData = await event.request.formData();
		const fieldId = formData.get('fieldId')?.toString();
		const direction = formData.get('direction')?.toString();
		if (!fieldId || (direction !== 'up' && direction !== 'down')) {
			return fail(400, { message: 'Invalid move' });
		}

		await moveFieldDefinition(event.params.objectTypeId, fieldId, direction);
		return { success: true };
	}
};
