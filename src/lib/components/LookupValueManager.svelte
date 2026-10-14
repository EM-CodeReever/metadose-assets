<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash } from '@lucide/svelte';

	let {
		title,
		description,
		values,
		form,
		showOutOfService = false
	}: {
		title: string;
		description: string;
		values: { id: string; name: string; outOfService?: boolean }[];
		form: { success?: boolean; message?: string } | null | undefined;
		showOutOfService?: boolean;
	} = $props();

	let addDialog: HTMLDialogElement;

	$effect(() => {
		if (form?.success) addDialog?.close();
	});
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold">{title}</h1>
			<p class="text-base-content/60 text-sm">{description}</p>
		</div>
		<button class="btn btn-primary btn-sm" onclick={() => addDialog.showModal()}>
			<Plus size={16} />
			Add
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
					{#each values as v (v.id)}
						<tr class="hover">
							<td class="font-medium">{v.name}</td>
							{#if showOutOfService}
								<td>
									<form method="post" action="?/setOutOfService" use:enhance>
										<input type="hidden" name="id" value={v.id} />
										<input type="hidden" name="outOfService" value={(!v.outOfService).toString()} />
										<label class="label cursor-pointer justify-start gap-2">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={v.outOfService}
												onchange={(e) => e.currentTarget.form?.requestSubmit()}
											/>
											<span class="label-text text-xs">Out of service</span>
										</label>
									</form>
								</td>
							{/if}
							<td class="text-right">
								<form method="post" action="?/delete" use:enhance>
									<input type="hidden" name="id" value={v.id} />
									<button type="submit" class="btn btn-ghost btn-xs text-error">
										<Trash size={14} />
									</button>
								</form>
							</td>
						</tr>
					{:else}
						<tr><td class="text-base-content/60">None yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<dialog bind:this={addDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Add {title.toLowerCase().replace(/s$/, '')}</h3>
		<form method="post" action="?/add" use:enhance class="mt-4 space-y-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Name</legend>
				<input name="name" required class="input w-full" />
			</fieldset>
			{#if showOutOfService}
				<label class="label cursor-pointer justify-start gap-2">
					<input type="checkbox" name="outOfService" class="checkbox checkbox-sm" />
					<span class="label-text">
						Out of service — items split into this condition are automatically taken out of
						circulation
					</span>
				</label>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => addDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary">Add</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
