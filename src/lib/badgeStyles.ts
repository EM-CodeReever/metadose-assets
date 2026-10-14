/** Semantic daisyUI badge color for a record's real, system-tracked lifecycle status. */
export function recordStatusBadgeClass(status: string): string {
	switch (status) {
		case 'available':
			return 'badge-info';
		case 'checked_out':
			return 'badge-success';
		case 'archived':
			return 'badge-neutral';
		default:
			return 'badge-ghost';
	}
}

import { Crown, Eye, ShieldCheck, User, UserCog } from '@lucide/svelte';

/** The one daisyUI semantic color standing for each organization role, by seniority. */
export function orgRoleColor(role: string): string {
	switch (role) {
		case 'owner':
			return 'primary';
		case 'admin':
			return 'secondary';
		case 'manager':
			return 'accent';
		case 'viewer':
			return 'neutral';
		case 'member':
			return 'info';
		default:
			return 'neutral';
	}
}

/** Semantic daisyUI badge color for an organization membership role, by seniority. */
export function orgRoleBadgeClass(role: string): string {
	return `badge-${orgRoleColor(role)}`;
}

/** Semantic daisyUI button color for an organization membership role, by seniority. */
export function orgRoleButtonClass(role: string): string {
	return `btn-${orgRoleColor(role)}`;
}

/** Icon representing each organization role at a glance. */
export function orgRoleIcon(role: string) {
	switch (role) {
		case 'owner':
			return Crown;
		case 'admin':
			return ShieldCheck;
		case 'manager':
			return UserCog;
		case 'viewer':
			return Eye;
		case 'member':
			return User;
		default:
			return Eye;
	}
}
