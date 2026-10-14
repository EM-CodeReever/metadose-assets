import { fail } from '@sveltejs/kit';
import { requireUser, resolveOrgMembership } from '$lib/server/authz';
import { getObjectTypeSummaries } from '$lib/server/services/objectTypes';
import { listMyOpenCheckouts, listOpenCheckouts } from '$lib/server/services/checkouts';
import { cancelCheckoutRequest, listMyCheckoutRequests } from '$lib/server/services/checkoutRequests';
import { listOrgActivity } from '$lib/server/services/activityLog';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { organization, membership, user } = await event.parent();

	// Members get a narrow "what's mine" view, not the admin operational dashboard.
	if (membership?.role === 'member') {
		const [myRequests, myCheckouts] = await Promise.all([
			listMyCheckoutRequests(organization.id, user.id),
			listMyOpenCheckouts(organization.id, user.id)
		]);
		return { organization, membership, isMemberView: true as const, myRequests, myCheckouts };
	}

	const [objectTypes, checkouts, activity, myCheckouts] = await Promise.all([
		getObjectTypeSummaries(organization.id),
		listOpenCheckouts(organization.id),
		listOrgActivity(organization.id, 10),
		// An owner/admin/manager is still a person who can have things checked out to them
		// personally — surfaced separately from the org-wide operational view below.
		listMyOpenCheckouts(organization.id, user.id)
	]);

	const totalRecords = objectTypes.reduce((sum, t) => sum + t.recordCount, 0);
	const overdueCount = checkouts.filter((c) => c.dueAt && new Date(c.dueAt).getTime() < Date.now()).length;

	return {
		organization,
		membership,
		isMemberView: false as const,
		objectTypes,
		checkouts,
		activity,
		myCheckouts,
		totalRecords,
		overdueCount
	};
};

export const actions: Actions = {
	cancelRequest: async (event) => {
		const user = requireUser(event);
		const orgMembership = await resolveOrgMembership(event, event.params.orgSlug);

		const formData = await event.request.formData();
		const requestId = formData.get('requestId')?.toString();
		if (!requestId) return fail(400, { message: 'Missing request' });

		try {
			await cancelCheckoutRequest(orgMembership.organization.id, requestId, user.id);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Could not cancel request' });
		}

		return { success: true };
	}
};
