<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let locationDialog: HTMLDialogElement;

	$effect(() => {
		if (form?.success) locationDialog?.close();
	});
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold">Locations</h1>
			<p class="text-base-content/60 text-sm">Where assets can be checked out to besides a person.</p>
		</div>
		<button class="btn btn-primary btn-sm" onclick={() => locationDialog.showModal()}>
			<Plus size={16} />
			Add location
		</button>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<div class="card bg-base-100 shadow">
		<div class="overflow-x-auto">
			<table class="table">
				<tbody>
					{#each data.locations as loc (loc.id)}
						<tr class="hover">
							<td class="font-medium">{loc.name}</td>
							<td class="text-base-content/60 text-sm">{loc.address ?? ''}</td>
							<td class="text-right">
								<form method="post" action="?/delete" use:enhance>
									<input type="hidden" name="locationId" value={loc.id} />
									<button type="submit" class="btn btn-ghost btn-xs text-error">
										<Trash size={14} />
									</button>
								</form>
							</td>
						</tr>
					{:else}
						<tr><td class="text-base-content/60">No locations yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<dialog bind:this={locationDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Add location</h3>
		<form method="post" action="?/add" use:enhance class="mt-4 space-y-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Name</legend>
				<input name="name" required class="input w-full" />
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Address (optional)</legend>
				<textarea name="address" class="textarea w-full" rows="2"></textarea>
			</fieldset>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => locationDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary">Add location</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
