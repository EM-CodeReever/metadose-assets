import type { auth } from '$lib/server/auth';

type AuthSession = typeof auth.$Infer.Session;

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Replaced at build time with package.json's version — see vite.config.ts's `define`.
	const __APP_VERSION__: string;

	namespace App {
		interface Locals { user?: AuthSession['user']; session?: AuthSession['session'] }

		interface Error { errorId?: string }
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
