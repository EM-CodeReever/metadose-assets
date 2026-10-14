import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [organizations, users] = await Promise.all([
		db.query.organization.findMany({
			with: { members: true },
			orderBy: (o, { desc }) => desc(o.createdAt)
		}),
		db.query.user.findMany({ orderBy: (u, { desc }) => desc(u.createdAt) })
	]);

	const superAdminCount = users.filter((u) => u.role === 'super_admin').length;

	return {
		organizationCount: organizations.length,
		userCount: users.length,
		superAdminCount,
		recentOrganizations: organizations.slice(0, 5),
		recentUsers: users.slice(0, 5)
	};
};
