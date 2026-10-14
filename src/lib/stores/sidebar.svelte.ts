import { browser } from '$app/environment';

const STORAGE_KEY = 'sidebar-collapsed';

function readInitial(): boolean {
	if (!browser) return false;
	return localStorage.getItem(STORAGE_KEY) === 'true';
}

const state = $state({ collapsed: readInitial() });

export function getSidebarState() {
	return state;
}

export function toggleSidebar() {
	state.collapsed = !state.collapsed;
	if (browser) {
		localStorage.setItem(STORAGE_KEY, String(state.collapsed));
	}
}
