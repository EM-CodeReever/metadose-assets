<script lang="ts">
	import { enhance } from '$app/forms';
	import { PackageCheck } from '@lucide/svelte';

	let {
		open = $bindable(false),
		checkoutId,
		eulaText,
		expectedName,
		action
	}: {
		open?: boolean;
		checkoutId: string;
		eulaText: string;
		/** The signed-in user's own name — shown as the instruction, and matched client-side only as
		 *  a UX nicety. The server independently re-validates against the account's real name. */
		expectedName: string;
		action: string;
	} = $props();

	let dialog: HTMLDialogElement;
	let typedName = $state('');
	let submitting = $state(false);
	let error = $state('');

	const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
	const matches = $derived(normalize(typedName) === normalize(expectedName));

	$effect(() => {
		if (open && !dialog.open) {
			typedName = '';
			error = '';
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Confirm receipt</h3>
		<p class="text-base-content/60 mt-1 text-sm">
			Read the agreement below, then type your full name exactly as shown to confirm you've
			received this and agree to its terms.
		</p>

		<div class="bg-base-200 eula-body mt-4 max-h-64 overflow-y-auto rounded-box p-3 text-sm">{@html eulaText}</div>

		<form
			method="post"
			{action}
			use:enhance={() => {
				submitting = true;
				error = '';
				return async ({ result, update }) => {
					submitting = false;
					if (result.type === 'failure') {
						error = (result.data?.message as string) ?? 'Could not confirm receipt';
					} else {
						await update();
						open = false;
					}
				};
			}}
			class="mt-4 space-y-3"
		>
			<input type="hidden" name="checkoutId" value={checkoutId} />
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Type your full name: <span class="font-semibold">{expectedName}</span></legend>
				<input name="typedName" bind:value={typedName} required class="input w-full" autocomplete="off" />
			</fieldset>
			{#if error}
				<div class="alert alert-error text-sm">
					<span>{error}</span>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" disabled={submitting} onclick={() => (open = false)}>Cancel</button>
				<button type="submit" class="btn btn-success" disabled={!matches || submitting}>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
						Confirming...
					{:else}
						<PackageCheck size={14} />
						Confirm receipt
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<style>
	.eula-body :global(p) {
		margin-bottom: 0.5em;
	}
	.eula-body :global(ul),
	.eula-body :global(ol) {
		margin-left: 1.25em;
		margin-bottom: 0.5em;
		list-style: revert;
	}
	.eula-body :global(blockquote) {
		border-left: 3px solid var(--color-base-300, #d1d5db);
		padding-left: 0.75em;
		margin-bottom: 0.5em;
		color: inherit;
		opacity: 0.8;
	}
	.eula-body :global(h1),
	.eula-body :global(h2),
	.eula-body :global(h3) {
		font-weight: 600;
		margin-bottom: 0.4em;
	}
</style>
