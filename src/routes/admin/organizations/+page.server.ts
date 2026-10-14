import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { requireSuperAdmin } from '$lib/server/authz';
import { ensureBuiltinObjectTypes } from '$lib/server/services/objectTypes';
import type { Actions, PageServerLoad } from './$types';

function slugify(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export const load: PageServerLoad = async () => {
	const organizations = await db.query.organization.findMany({
		with: { members: true },
		orderBy: (organization, { desc }) => desc(organization.createdAt)
	});
	return { organizations };
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireSuperAdmin(event);
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const slugInput = formData.get('slug')?.toString().trim();
		if (!name) return fail(400, { message: 'Name is required' });

		const slug = slugify(slugInput || name);
		if (!slug) return fail(400, { message: 'Could not derive a valid slug from that name' });

		let organizationId: string | undefined;
		try {
			const created = await auth.api.createOrganization({
				headers: event.request.headers,
				body: { name, slug }
			});
			organizationId = created?.id;
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { message: err.message || 'Could not create organization' });
			}
			throw err;
		}

		if (organizationId) {
			await ensureBuiltinObjectTypes(organizationId, user.id);
		}

		return { success: true };
	}
};
