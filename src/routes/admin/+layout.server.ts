import { requireSuperAdmin } from '$lib/server/authz';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
	const user = requireSuperAdmin(event);
	return { user };
};
