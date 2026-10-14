import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { member as memberTable } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/authz';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	if (user.role === 'super_admin') {
		throw redirect(302, '/admin');
	}

	const memberships = await db.query.member.findMany({
		where: eq(memberTable.userId, user.id),
		with: { organization: true }
	});

	if (memberships.length === 1) {
		throw redirect(302, `/o/${memberships[0].organization.slug}`);
	}

	return { memberships };
};
