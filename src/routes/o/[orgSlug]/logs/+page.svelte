<script lang="ts">
	import { ChevronDown, ChevronLeft, ChevronRight, ScrollText } from '@lucide/svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	type Entry = PageServerData['entries'][number];

	let expanded = $state<Set<string>>(new Set());
	function toggle(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expanded = next;
	}

	function formatDate(value: string | Date | null | undefined): string {
		if (!value) return '—';
		return new Date(value).toLocaleString();
	}

	function categoryOf(action: string): string {
		return action.split('.')[0];
	}

	function actionLabel(action: string): string {
		const verb = action.split('.').slice(1).join(' ').replace(/_/g, ' ');
		return verb || action;
	}

	function recordLink(entry: Entry): string | undefined {
		const objectType = entry.record?.objectType ?? entry.objectType;
		if (!objectType) return undefined;
		if (entry.recordId) return `/o/${data.organization.slug}/${objectType.slug}/${entry.recordId}`;
		return `/o/${data.organization.slug}/object-types/${objectType.id}`;
	}

	function recordLabel(entry: Entry): string | undefined {
		if (entry.record) {
			const name = (entry.record.data as { values?: Record<string, unknown> } | null)?.values?.name;
			return typeof name === 'string' && name ? name : entry.record.objectType?.name;
		}
		return entry.objectType?.name;
	}

	const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

	function pageUrl(page: number): string {
		const params = new URLSearchParams();
		if (data.filters.category) params.set('category', data.filters.category);
		if (data.filters.action) params.set('action', data.filters.action);
		if (data.filters.actorUserId) params.set('actor', data.filters.actorUserId);
		if (data.filters.search) params.set('q', data.filters.search);
		if (data.filters.from) params.set('from', data.filters.from);
		if (data.filters.to) params.set('to', data.filters.to);
		if (page > 1) params.set('page', String(page));
		const qs = params.toString();
		return `/o/${data.organization.slug}/logs${qs ? `?${qs}` : ''}`;
	}

	const hasActiveFilters = $derived(
		!!(data.filters.category || data.filters.action || data.filters.actorUserId || data.filters.search || data.filters.from || data.filters.to)
	);
</script>

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<ScrollText size={20} class="text-primary" />
		<div>
			<h1 class="text-lg font-semibold">Activity logs</h1>
			<p class="text-base-content/60 text-sm">
				Every assignment, check-in, edit, and configuration change recorded for {data.organization.name}.
			</p>
		</div>
	</div>

	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<form method="GET" class="card-body flex-row flex-wrap items-end gap-3 py-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Category</legend>
				<select name="category" class="select select-sm w-40">
					<option value="">All categories</option>
					{#each data.categories as c (c)}
						<option value={c} selected={data.filters.category === c}>{c.replace('_', ' ')}</option>
					{/each}
				</select>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Action</legend>
				<select name="action" class="select select-sm w-52">
					<option value="">All actions</option>
					{#each data.actions as a (a)}
						<option value={a} selected={data.filters.action === a}>{a}</option>
					{/each}
				</select>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Actor</legend>
				<select name="actor" class="select select-sm w-44">
					<option value="">Anyone</option>
					{#each data.orgUsers as u (u.id)}
						<option value={u.id} selected={data.filters.actorUserId === u.id}>{u.name}</option>
					{/each}
				</select>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">From</legend>
				<input type="date" name="from" class="input input-sm w-36" value={data.filters.from} />
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">To</legend>
				<input type="date" name="to" class="input input-sm w-36" value={data.filters.to} />
			</fieldset>
			<fieldset class="fieldset grow">
				<legend class="fieldset-legend">Search</legend>
				<input
					type="search"
					name="q"
					placeholder="Search summaries..."
					class="input input-sm w-full min-w-48"
					value={data.filters.search}
				/>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend" aria-hidden="true">&nbsp;</legend>
				<div class="flex gap-2">
					<button type="submit" class="btn btn-primary btn-sm">Filter</button>
					{#if hasActiveFilters}
						<a href={`/o/${data.organization.slug}/logs`} class="btn btn-ghost btn-sm">Clear</a>
					{/if}
				</div>
			</fieldset>
		</form>
	</div>

	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr class="bg-base-200">
						<th class="text-xs font-semibold tracking-wider uppercase">Time</th>
						<th class="text-xs font-semibold tracking-wider uppercase">Actor</th>
						<th class="text-xs font-semibold tracking-wider uppercase">Category</th>
						<th class="text-xs font-semibold tracking-wider uppercase">Record / object</th>
						<th class="text-xs font-semibold tracking-wider uppercase">Summary</th>
						<th class="w-10"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.entries as entry (entry.id)}
						{@const link = recordLink(entry)}
						{@const label = recordLabel(entry)}
						{@const hasDetails = !!entry.changes}
						<tr class="hover">
							<td class="text-base-content/70 text-sm whitespace-nowrap">{formatDate(entry.createdAt)}</td>
							<td class="text-sm">{entry.actor?.name ?? 'System'}</td>
							<td>
								<span class="badge badge-outline badge-sm font-normal capitalize">
									{categoryOf(entry.action).replace('_', ' ')}
								</span>
								<span class="text-base-content/60 text-xs">{actionLabel(entry.action)}</span>
							</td>
							<td class="text-sm">
								{#if link}
									<a href={link} class="link link-hover font-medium">{label ?? 'View'}</a>
								{:else}
									<span class="text-base-content/40">—</span>
								{/if}
							</td>
							<td class="text-sm">{entry.summary ?? '—'}</td>
							<td class="text-right">
								{#if hasDetails}
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										aria-label="Toggle details"
										onclick={() => toggle(entry.id)}
									>
										<ChevronDown size={14} class="transition-transform {expanded.has(entry.id) ? 'rotate-180' : ''}" />
									</button>
								{/if}
							</td>
						</tr>
						{#if hasDetails && expanded.has(entry.id)}
							<tr>
								<td colspan={6} class="bg-base-200/50">
									<pre class="overflow-x-auto p-2 text-xs">{JSON.stringify(entry.changes, null, 2)}</pre>
								</td>
							</tr>
						{/if}
					{:else}
						<tr><td colspan={6} class="text-base-content/60">No activity matches these filters.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.total > 0}
			<div class="border-base-300 flex items-center justify-between border-t px-4 py-3">
				<p class="text-base-content/60 text-xs">
					Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}
				</p>
				<div class="join">
					<a
						href={pageUrl(data.page - 1)}
						class="btn btn-ghost btn-xs join-item"
						class:btn-disabled={data.page <= 1}
						aria-disabled={data.page <= 1}
					>
						<ChevronLeft size={14} />
					</a>
					<span class="btn btn-ghost btn-xs join-item pointer-events-none">
						{data.page} / {totalPages}
					</span>
					<a
						href={pageUrl(data.page + 1)}
						class="btn btn-ghost btn-xs join-item"
						class:btn-disabled={data.page >= totalPages}
						aria-disabled={data.page >= totalPages}
					>
						<ChevronRight size={14} />
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
