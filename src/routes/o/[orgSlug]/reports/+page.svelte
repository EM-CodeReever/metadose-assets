<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChartColumn, Plus, Trash } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (form?.success) dialog?.close();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold">Reports</h1>
			<p class="text-base-content/60 text-sm">Build custom views and export data from any object type.</p>
		</div>
		<button
			class="btn btn-primary"
			disabled={data.objectTypes.length === 0}
			onclick={() => dialog.showModal()}
		>
			<Plus size={16} />
			New report
		</button>
	</div>

	{#if data.objectTypes.length === 0}
		<div class="alert">
			<span>Create an object type first before building a report.</span>
		</div>
	{/if}

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	{#if data.reports.length === 0}
		<div class="card bg-base-100 shadow">
			<div class="card-body items-center py-12 text-center">
				<ChartColumn size={32} class="text-base-content/30" />
				<p class="text-base-content/60">No reports yet.</p>
			</div>
		</div>
	{:else}
		<div class="card bg-base-100 shadow">
			<div class="overflow-x-auto">
				<table class="table">
					<tbody>
						{#each data.reports as report (report.id)}
							<tr class="hover">
								<td>
									<a
										href={`/o/${data.organization.slug}/reports/${report.id}`}
										class="link link-hover font-medium"
									>
										{report.name}
									</a>
								</td>
								<td class="text-base-content/60 text-sm">{report.objectType.name}</td>
								<td class="text-right">
									<form method="post" action="?/delete" use:enhance>
										<input type="hidden" name="reportId" value={report.id} />
										<button type="submit" class="btn btn-ghost btn-xs text-error">
											<Trash size={14} />
										</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<dialog bind:this={dialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">New report</h3>
		<form method="post" action="?/create" use:enhance class="mt-4 space-y-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Name</legend>
				<input name="name" required class="input w-full" />
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Object type</legend>
				<select name="objectTypeId" required class="select w-full">
					<option value="" disabled selected>Select an object type</option>
					{#each data.objectTypes as ot (ot.id)}
						<option value={ot.id}>{ot.name}</option>
					{/each}
				</select>
			</fieldset>
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
