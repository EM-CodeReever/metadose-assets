import { browser } from '$app/environment';

export const THEMES = [
	'light',
	'dark',
	'dim',
	'night',
	'forest',
	'winter',
	'cupcake',
	'aqua',
	'coffee',
	'nord'
] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'light';

function isTheme(value: string | null): value is Theme {
	return !!value && (THEMES as readonly string[]).includes(value);
}

function readInitialTheme(): Theme {
	if (!browser) return DEFAULT_THEME;
	const stored = localStorage.getItem(STORAGE_KEY);
	return isTheme(stored) ? stored : DEFAULT_THEME;
}

const state = $state({ current: readInitialTheme() });

export function getThemeState() {
	return state;
}

export function setTheme(value: Theme) {
	state.current = value;
	if (browser) {
		document.documentElement.setAttribute('data-theme', value);
		localStorage.setItem(STORAGE_KEY, value);
	}
}
