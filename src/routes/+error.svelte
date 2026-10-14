<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, FileQuestion, LayoutDashboard, ShieldAlert, TriangleAlert } from '@lucide/svelte';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong.');

	const title = $derived(
		status === 403
			? 'Permission denied'
			: status === 404
				? 'Not found'
				: status === 401
					? 'Sign in required'
					: 'Something went wrong'
	);

	const description = $derived(
		status === 403
			? "You're signed in, but your role doesn't allow this. If you think that's wrong, ask an org admin or owner to update your permissions."
			: status === 404
				? "The page you're looking for doesn't exist, or you don't have access to it."
				: message
	);

	const iconWrapClass = $derived(
		status === 403
			? 'bg-error/10 text-error'
			: status === 404
				? 'bg-warning/10 text-warning'
				: 'bg-base-300'
	);
</script>

<svelte:head>
	<title>{status} — {title}</title>
</svelte:head>

<div class="bg-base-200 flex min-h-screen items-center justify-center p-6">
	<div class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body items-center text-center">
			<div class="flex size-16 items-center justify-center rounded-full {iconWrapClass}">
				{#if status === 403}
					<ShieldAlert size={32} />
				{:else if status === 404}
					<FileQuestion size={32} />
				{:else}
					<TriangleAlert size={32} />
				{/if}
			</div>

			<p class="text-base-content/50 mt-4 text-sm font-medium tracking-wide uppercase">Error {status}</p>
			<h1 class="text-xl font-semibold">{title}</h1>
			<p class="text-base-content/60 mt-1 text-sm">{description}</p>

			<div class="card-actions mt-6 w-full gap-2">
				<button type="button" class="btn btn-ghost flex-1" onclick={() => history.back()}>
					<ArrowLeft size={16} />
					Go back
				</button>
				<a href="/" class="btn btn-primary flex-1">
					<LayoutDashboard size={16} />
					Dashboard
				</a>
			</div>
		</div>
	</div>
</div>
