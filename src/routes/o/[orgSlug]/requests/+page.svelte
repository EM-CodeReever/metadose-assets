<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, X } from '@lucide/svelte';
	import LocationSelect from '$lib/components/LocationSelect.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	type Request = PageServerData['requests'][number];

	let rejectDialog: HTMLDialogElement;
	let rejectTarget = $state<Request | null>(null);

	function openReject(request: Request) {
		rejectTarget = request;
		rejectDialog.showModal();
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<h1 class="text-lg font-semibold">Requests</h1>
		<p class="text-base-content/60 text-sm">Pending requests from members to be assigned an item.</p>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	{#if data.requests.length === 0}
		<div class="card bg-base-100 shadow">
			<div class="card-body items-center py-12 text-center">
				<p class="text-base-content/60">No pending requests.</p>
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.requests as request (request.id)}
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<div>
								<a
									href={`/o/${data.organization.slug}/${request.record.objectType.slug}/${request.recordId}`}
									class="link link-primary font-medium"
								>
									{request.record.data.values.name ?? request.record.objectType.name}
								</a>
								<p class="text-base-content/60 text-sm">
									Requested by {request.requestedByUser.name} · {new Date(request.createdAt).toLocaleString()}
								</p>
								{#if request.note}
									<p class="text-base-content/60 mt-1 text-sm">"{request.note}"</p>
								{/if}
							</div>
							<button type="button" class="btn btn-ghost btn-sm text-error" onclick={() => openReject(request)}>
								<X size={14} />
								Reject
							</button>
						</div>

						<form method="post" action="?/approve" use:enhance class="mt-2 flex flex-wrap items-end gap-3">
							<input type="hidden" name="requestId" value={request.id} />
							{#if request.rules.targetType === 'user_or_location'}
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Location</legend>
									<LocationSelect name="assignedToLocationId" required orgSlug={data.organization.slug} options={data.locations} />
								</fieldset>
							{:else}
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Quantity</legend>
									<input type="number" name="quantity" min="1" value="1" class="input input-sm w-24" />
								</fieldset>
							{/if}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Due back (optional)</legend>
								<input type="date" name="dueAt" class="input input-sm w-auto" />
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend" aria-hidden="true">&nbsp;</legend>
								<button type="submit" class="btn btn-primary btn-sm">
									<Check size={14} />
									Approve
								</button>
							</fieldset>
						</form>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<dialog bind:this={rejectDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Reject this request?</h3>
		<form method="post" action="?/reject" use:enhance class="mt-4 space-y-4">
			<input type="hidden" name="requestId" value={rejectTarget?.id ?? ''} />
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Reason (optional)</legend>
				<textarea name="decisionNote" class="textarea w-full" rows="2"></textarea>
			</fieldset>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => rejectDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-error">Reject</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
