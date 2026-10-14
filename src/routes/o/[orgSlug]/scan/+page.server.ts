import { redirect } from '@sveltejs/kit';
import { findRecordById, findRecordsByLabelValue } from '$lib/server/services/recordLookup';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization } = await event.parent();
	const code = event.url.searchParams.get('code')?.trim() ?? '';

	if (!code) {
		return { organization, code: '', matches: [] };
	}

	// A printed barcode's primary payload is the record's own id — check that first, since it's
	// always unique and unambiguous. Only fall back to field-value matching (a typed-in serial
	// number, or a barcode from before this was the default) when it's not a direct id match.
	const byId = await findRecordById(organization.id, code);
	if (byId) {
		throw redirect(303, `/o/${organization.slug}/${byId.objectTypeSlug}/${byId.recordId}`);
	}

	const matches = await findRecordsByLabelValue(organization.id, code);
	if (matches.length === 1) {
		throw redirect(303, `/o/${organization.slug}/${matches[0].objectTypeSlug}/${matches[0].recordId}`);
	}

	return { organization, code, matches };
};
