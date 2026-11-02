<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { CircleX, Search, RefreshCw } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const ROLE_OPTIONS = ['owner', 'admin', 'manager', 'viewer', 'member'];

	let useFilter = $state(true);
	let selectedGroups = $state<Set<string>>(new Set());
	let searching = $state(false);
	let syncing = $state(false);

	let candidates = $state<{ name: string; email: string }[]>([]);
	let selected = $state<boolean[]>([]);

	// A fresh search result replaces the candidate list and defaults everything to selected —
	// these already matched the filter/groups the admin just asked for.
	$effect(() => {
		if (form?.candidates) {
			untrack(() => {
				candidates = form.candidates;
				selected = form.candidates.map(() => true);
			});
		}
	});

	const allSelected = $derived(candidates.length > 0 && selected.every(Boolean));
	const someSelected = $derived(selected.some(Boolean) && !allSelected);
	const selectedCount = $derived(selected.filter(Boolean).length);
	const selectedCandidatesJson = $derived(JSON.stringify(candidates.filter((_, i) => selected[i])));

	function indeterminate(node: HTMLInputElement, value: boolean) {
		node.indeterminate = value;
		return { update: (v: boolean) => (node.indeterminate = v) };
	}

	function toggleAll(checked: boolean) {
		selected = candidates.map(() => checked);
	}

	let organizationId = $state('');
	let role = $state('member');
</script>

<div class="mx-auto max-w-4xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<a href="/admin/settings/ldap" class="link link-primary text-sm">&larr; LDAP settings</a>
		<h1 class="text-lg font-semibold">LDAP sync</h1>
		<p class="text-base-content/60 text-sm">
			Search first, review exactly who matched, then confirm — nothing is created until you
			pick who to sync.
		</p>
	</div>

	{#if !data.configured}
		<div class="alert alert-warning text-sm">
			<span>{data.configError} — set it up on the LDAP settings page first.</span>
		</div>
	{:else}
		<div class="card bg-base-100 shadow">
			<div class="card-body space-y-4">
				<h2 class="card-title text-base">1. Search</h2>
				<form
					method="post"
					action="?/search"
					use:enhance={() => {
						searching = true;
						return async ({ update }) => {
							await update();
							searching = false;
						};
					}}
					class="space-y-3"
				>
					<label class="label cursor-pointer justify-start gap-2">
						<input type="checkbox" name="useFilter" class="checkbox checkbox-sm" bind:checked={useFilter} />
						<span class="label-text">OU filter (the search base + user filter set on the LDAP settings page)</span>
					</label>
					{#if data.groupDns.length > 0}
						<p class="text-base-content/60 text-xs">Or sync from specific groups instead/as well:</p>
						{#each data.groupDns as groupDn (groupDn)}
							<label class="label cursor-pointer justify-start gap-2">
								<input
									type="checkbox"
									name="groups"
									value={groupDn}
									class="checkbox checkbox-sm"
									checked={selectedGroups.has(groupDn)}
									onchange={(e) => {
										const next = new Set(selectedGroups);
										if (e.currentTarget.checked) next.add(groupDn);
										else next.delete(groupDn);
										selectedGroups = next;
									}}
								/>
								<span class="label-text font-mono text-xs">{groupDn}</span>
							</label>
						{/each}
					{/if}

					{#if form?.searched && form?.message}
						<div class="alert alert-error text-sm">
							<span>{form.message}</span>
						</div>
					{/if}

					<div class="border-base-300 flex justify-end border-t pt-3">
						<button type="submit" class="btn btn-primary btn-sm" disabled={searching}>
							{#if searching}
								<span class="loading loading-spinner loading-xs"></span>
								Searching...
							{:else}
								<Search size={14} />
								Search LDAP
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>

		{#if candidates.length > 0}
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					<h2 class="card-title text-base">2. Pick who to sync</h2>
					<p class="text-base-content/60 text-sm">{candidates.length} user{candidates.length === 1 ? '' : 's'} matched.</p>

					<div class="overflow-x-auto">
						<table class="table">
							<thead>
								<tr>
									<th class="w-8">
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											checked={allSelected}
											use:indeterminate={someSelected}
											onchange={(e) => toggleAll(e.currentTarget.checked)}
										/>
									</th>
									<th>Name</th>
									<th>Email</th>
								</tr>
							</thead>
							<tbody>
								{#each candidates as c, i (c.email)}
									<tr class="hover">
										<td>
											<input type="checkbox" class="checkbox checkbox-sm" bind:checked={selected[i]} />
										</td>
										<td>{c.name}</td>
										<td class="text-base-content/70">{c.email}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<form
						method="post"
						action="?/confirmSync"
						use:enhance={() => {
							syncing = true;
							return async ({ update }) => {
								await update();
								syncing = false;
							};
						}}
						class="border-base-300 space-y-4 border-t pt-4"
					>
						<input type="hidden" name="selectedCandidates" value={selectedCandidatesJson} />

						<div class="flex flex-wrap items-end gap-3">
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Add to organization</legend>
								<select name="organizationId" bind:value={organizationId} class="select w-56">
									<option value="">Don't add to an organization</option>
									{#each data.organizations as org (org.id)}
										<option value={org.id}>{org.name}</option>
									{/each}
								</select>
							</fieldset>
							{#if organizationId}
								<fieldset class="fieldset">
									<legend class="fieldset-legend">Role</legend>
									<select name="role" bind:value={role} class="select w-40">
										{#each ROLE_OPTIONS as r (r)}
											<option value={r}>{r}</option>
										{/each}
									</select>
								</fieldset>
							{/if}
						</div>

						<label class="label cursor-pointer justify-start gap-2">
							<input type="checkbox" name="sendWelcomeEmail" class="checkbox checkbox-sm" />
							<span class="label-text">Send a welcome email to newly-created accounts</span>
						</label>
						<p class="text-base-content/50 -mt-2 text-xs">
							Points them at sign-in with their existing directory credentials — off by default since
							an LDAP account doesn't need anything emailed to be usable.
						</p>

						{#if form?.synced}
							{#if form?.success}
								<div class="alert {form.failed > 0 ? 'alert-warning' : 'alert-success'} text-sm">
									<span>
										Synced {form.created} user{form.created === 1 ? '' : 's'}.
										{#if form.failed > 0}{form.failed} failed.{/if}
									</span>
								</div>
								{#if form.errors?.length > 0}
									<ul class="divide-base-300 divide-y text-sm">
										{#each form.errors as err (err.row)}
											<li class="flex items-start gap-2 py-2">
												<CircleX size={14} class="text-error mt-0.5 shrink-0" />
												<span>{err.message}</span>
											</li>
										{/each}
									</ul>
								{/if}
							{:else if form?.message}
								<div class="alert alert-error text-sm">
									<span>{form.message}</span>
								</div>
							{/if}
						{/if}

						<div class="flex justify-end">
							<button type="submit" class="btn btn-primary" disabled={syncing || selectedCount === 0}>
								{#if syncing}
									<span class="loading loading-spinner loading-sm"></span>
									Syncing...
								{:else}
									<RefreshCw size={14} />
									Sync {selectedCount} user{selectedCount === 1 ? '' : 's'}
								{/if}
							</button>
						</div>
					</form>
				</div>
			</div>
		{/if}
	{/if}
</div>
