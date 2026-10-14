import { requireUser } from '$lib/server/authz';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	return { user: { name: user.name, email: user.email, role: user.role } };
};
