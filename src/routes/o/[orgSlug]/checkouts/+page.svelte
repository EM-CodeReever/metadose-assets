<script lang="ts">
	import { enhance } from '$app/forms';
	import { PackageCheck } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	function formatDate(value: string | Date | null | undefined): string {
		if (!value) return '—';
		return new Date(value).toLocaleString();
	}

	function isOverdue(dueAt: string | Date | null): boolean {
		return !!dueAt && new Date(dueAt).getTime() < Date.now();
	}

	function holderName(c: (typeof data.checkouts)[number]): string {
		if (c.assignedToUser && c.assignedToLocation) return `${c.assignedToUser.name} — ${c.assignedToLocation.name}`;
		return c.assignedToUser?.name ?? c.assignedToLocation?.name ?? String(c.assignedToRecord?.data.values.name ?? '—');
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-lg font-semibold">Checkouts</h1>
		<p class="text-base-content/60 text-sm">Everything currently checked out across this organization.</p>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<div class="card bg-base-100 shadow">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Record</th>
						<th>Kind</th>
						<th>Assigned to</th>
						<th>Checked out by</th>
						<th>Due back</th>
						<th class="text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.checkouts as c (c.id)}
						<tr class="hover">
							<td>
								<a
									href={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.recordId}`}
									class="link link-hover font-medium"
								>
									{c.record.data.values.name ?? c.record.objectType.name}
								</a>
							</td>
							<td class="text-base-content/60 text-sm capitalize">{c.record.objectType.builtinKind}</td>
							<td>
								{holderName(c)}
								{#if c.quantity > 1}<span class="text-base-content/50"> × {c.quantity}</span>{/if}
							</td>
							<td>{c.checkedOutByUser?.name}</td>
							<td class={isOverdue(c.dueAt) ? 'text-error font-medium' : ''}>
								{formatDate(c.dueAt)}
							</td>
							<td class="text-right">
								{#if c.record.objectType.builtinKind !== 'consumable'}
									<form method="post" action="?/checkin" use:enhance>
										<input type="hidden" name="checkoutId" value={c.id} />
										<button type="submit" class="btn btn-ghost btn-xs">
											<PackageCheck size={14} />
											Check in
										</button>
									</form>
								{/if}
							</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="text-base-content/60">Nothing is currently checked out.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
