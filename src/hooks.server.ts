import type { Handle, HandleServerError } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { runMaintenanceCheckSweep } from '$lib/server/services/maintenanceScheduler';

const ONE_HOUR_MS = 60 * 60 * 1000;

// Guarded by a global flag (survives Vite's HMR re-running this module on every dev-time file
// change, which would otherwise stack up duplicate intervals) and `building` (this module is also
// imported transiently during `vite build`, which must never start background timers).
declare global {
	// eslint-disable-next-line no-var
	var __maintenanceSchedulerStarted: boolean | undefined;
}
if (!building && !globalThis.__maintenanceSchedulerStarted) {
	globalThis.__maintenanceSchedulerStarted = true;
	runMaintenanceCheckSweep().catch((err) => console.error('[maintenance sweep]', err));
	setInterval(() => {
		runMaintenanceCheckSweep().catch((err) => console.error('[maintenance sweep]', err));
	}, ONE_HOUR_MS).unref();
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;

// Unhandled exceptions from a load/action/endpoint land here before SvelteKit turns them into a
// generic 500 — logged with a correlation id (shown to the user, searchable in container logs)
// since the default behavior otherwise just prints the stack with no easy way to tie a support
// report back to a specific log line.
export const handleError: HandleServerError = async ({ error, event }) => {
	const errorId = randomUUID();
	console.error(`[error ${errorId}] ${event.request.method} ${event.url.pathname}`, error);
	return {
		message: 'Something went wrong. If this keeps happening, mention this reference:',
		errorId
	};
};
