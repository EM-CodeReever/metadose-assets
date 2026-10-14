<script lang="ts">
	import { enhance } from '$app/forms';
	import { Boxes, Layers, Package, Plus } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let dialog: HTMLDialogElement;
	let trackingMode = $state<'individual' | 'bulk'>('individual');

	function openCreateDialog() {
		trackingMode = 'individual';
		dialog.showModal();
	}

	$effect(() => {
		if (form?.success) dialog?.close();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold">Object types</h1>
			<p class="text-base-content/60 text-sm">
				Every table this organization tracks, including the built-in Assets, Accessories,
				Consumables, and Components.
			</p>
		</div>
		<button class="btn btn-primary" onclick={openCreateDialog}>
			<Plus size={16} />
			New custom object type
		</button>
	</div>

	{#if data.objectTypes.length === 0}
		<div class="card bg-base-100 shadow">
			<div class="card-body items-center py-12 text-center">
				<Boxes size={32} class="text-base-content/30" />
				<p class="text-base-content/60">No object types yet.</p>
			</div>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
			{#each data.objectTypes as ot (ot.id)}
				<a
					href={`/o/${data.organization.slug}/object-types/${ot.id}`}
					class="card bg-base-100 shadow transition-shadow hover:shadow-md"
				>
					<div class="card-body">
						<div class="flex items-center justify-between">
							<h2 class="card-title text-base">{ot.name}</h2>
							{#if ot.builtinKind !== 'custom'}
								<span class="badge badge-ghost badge-sm capitalize">{ot.builtinKind}</span>
							{:else}
								<span class="badge badge-ghost badge-sm gap-1" title="{ot.trackingMode === 'bulk' ? 'Tracked in bulk by quantity' : 'Individually tracked'}">
									{#if ot.trackingMode === 'bulk'}
										<Layers size={11} />
										Bulk
									{:else}
										<Package size={11} />
										Individual
									{/if}
								</span>
							{/if}
						</div>
						{#if ot.description}
							<p class="text-base-content/60 line-clamp-2 text-sm">{ot.description}</p>
						{/if}
						<div class="card-actions mt-2">
							<span class="badge badge-ghost badge-sm">
								{ot.fields.length} field{ot.fields.length === 1 ? '' : 's'}
							</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<dialog bind:this={dialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">New custom object type</h3>

		<form method="post" action="?/create" use:enhance class="mt-4 space-y-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Name</legend>
				<input name="name" required placeholder="e.g. Vehicles, Software Licenses" class="input w-full" />
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Description (optional)</legend>
				<textarea name="description" class="textarea w-full" rows="2"></textarea>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">How are records of this type tracked?</legend>
				<div class="join w-full">
					<label class="join-item btn btn-sm flex-1 gap-1.5" class:btn-primary={trackingMode === 'individual'}>
						<input
							type="radio"
							name="tracking-mode-tab"
							value="individual"
							class="hidden"
							bind:group={trackingMode}
						/>
						<Package size={14} />
						Individually
					</label>
					<label class="join-item btn btn-sm flex-1 gap-1.5" class:btn-primary={trackingMode === 'bulk'}>
						<input type="radio" name="tracking-mode-tab" value="bulk" class="hidden" bind:group={trackingMode} />
						<Layers size={14} />
						By quantity
					</label>
				</div>
				<input type="hidden" name="trackingMode" value={trackingMode} />
				<p class="text-base-content/50 text-xs">
					{#if trackingMode === 'individual'}
						Like Assets — each record is one unique unit, checked out whole, to a user or a location.
					{:else}
						Like Accessories — records represent a quantity of stock. Once you've added a number
						field for the total, come back to this type's settings to designate it as the
						quantity field.
					{/if}
				</p>
			</fieldset>
			{#if trackingMode === 'individual'}
				<label class="label cursor-pointer justify-start gap-2">
					<input type="checkbox" name="allowComponentInstall" class="checkbox checkbox-sm" />
					<span class="label-text">Components can be installed into records of this type</span>
				</label>
			{/if}
			{#if form?.message}
				<div class="alert alert-error text-sm">
					<span>{form.message}</span>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary">Create</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
