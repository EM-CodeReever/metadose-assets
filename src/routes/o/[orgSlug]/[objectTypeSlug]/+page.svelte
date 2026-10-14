<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { ArrowDown, ArrowUp, Clock, Columns3, Download, PackagePlus, Pin, Plus, Search, Upload } from '@lucide/svelte';
	import { recordStatusBadgeClass } from '$lib/badgeStyles';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	type Field = PageServerData['objectType']['fields'][number];
	type Row = PageServerData['rows'][number];

	const orgUserNames = $derived(new Map(data.orgUsers.map((u) => [u.id, u.name])));
	const lookupNames = $derived(new Map(Object.values(data.lookupValues).flat().map((v) => [v.id, v.name])));
	const filterableFields = $derived(data.objectType.fields.filter((f) => f.filterable));
	const kind = $derived(data.objectType.builtinKind);
	const hasLocationColumn = $derived(data.rules.targetType === 'user_or_location');
	const isMember = $derived(data.membership?.role === 'member');

	/** Best-effort client hint only — the `request` action is the real authority on availability. */
	function isRequestable(row: Row): boolean {
		if (kind === 'component') return false;
		if (!(row.requestableOverride ?? data.objectType.requestable)) return false;
		if (row.status === 'archived') return false;
		if (kind === 'consumable') return (Number(row.data.values.remainingQuantity) || 0) > 0;
		if (data.rules.targetType === 'user_or_location') return row.status === 'available';
		return true;
	}

	const NEW_LABELS: Record<string, string> = {
		asset: 'New asset',
		accessory: 'New accessory',
		consumable: 'New consumable',
		component: 'New component'
	};
	const newLabel = $derived(NEW_LABELS[kind] ?? 'New record');

	interface ColumnDef {
		key: string;
		label: string;
	}

	// Every choosable column: this type's fields, plus the two derived, non-field columns.
	const allColumns = $derived.by((): ColumnDef[] => {
		const cols: ColumnDef[] = data.objectType.fields.map((f) => ({ key: f.key, label: f.label }));
		if (hasLocationColumn) cols.push({ key: 'location', label: 'Location' });
		cols.push({ key: 'status', label: kind === 'consumable' ? 'Actions' : 'Status' });
		return cols;
	});

	const columnsStorageKey = $derived(`mds:columns:${data.objectType.id}`);

	function loadVisibleColumns(): Set<string> {
		if (browser) {
			try {
				const raw = localStorage.getItem(columnsStorageKey);
				if (raw) return new Set(JSON.parse(raw));
			} catch {
				// fall through to default
			}
		}
		return new Set(allColumns.map((c) => c.key));
	}

	let visibleColumns = $state<Set<string>>(new Set());

	// Re-derive from localStorage whenever the object type changes — this page component is
	// reused across navigations between types (e.g. Assets -> Accessories), so a one-time
	// initializer would keep showing the previous type's column selection.
	$effect(() => {
		visibleColumns = loadVisibleColumns();
	});

	function toggleColumn(key: string, checked: boolean) {
		const next = new Set(visibleColumns);
		if (checked) next.add(key);
		else next.delete(key);
		// Always keep at least one column visible.
		if (next.size === 0) return;
		visibleColumns = next;
		if (browser) localStorage.setItem(columnsStorageKey, JSON.stringify([...next]));
		// Hiding the pinned column would leave a stale pin pointing at nothing.
		if (!checked && pinnedColumn === key) setPinnedColumn(null);
	}

	const visibleFields = $derived(data.objectType.fields.filter((f) => visibleColumns.has(f.key)));

	// Pinning sticks one column to the right edge of the scrollable table — for a wide,
	// user-defined set of columns (custom fields can be anything), this is how someone keeps,
	// say, Status in view while scrolling through the rest rather than scrolling back and forth.
	// Only one at a time: with dynamic column widths there's no cheap way to stack multiple
	// sticky columns' offsets without measuring rendered widths in JS, and a single pin already
	// covers the real want (one column, usually Status, staying visible).
	const pinStorageKey = $derived(`mds:pinned-column:${data.objectType.id}`);

	function loadPinnedColumn(): string | null {
		if (!browser) return null;
		try {
			return localStorage.getItem(pinStorageKey);
		} catch {
			return null;
		}
	}

	let pinnedColumn = $state<string | null>(null);

	$effect(() => {
		pinnedColumn = loadPinnedColumn();
	});

	function setPinnedColumn(key: string | null) {
		pinnedColumn = key;
		if (browser) {
			if (key) localStorage.setItem(pinStorageKey, key);
			else localStorage.removeItem(pinStorageKey);
		}
	}

	function togglePin(key: string) {
		setPinnedColumn(pinnedColumn === key ? null : key);
	}

	/** Sticky-to-the-right classes for whichever single column is pinned, else ''. */
	function pinnedClass(key: string): string {
		return pinnedColumn === key
			? 'bg-base-100 group-hover:bg-base-200 sticky right-0 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.15)]'
			: '';
	}

	let stockDialog: HTMLDialogElement;
	let stockTarget = $state<Row | null>(null);
	let stockError = $state('');

	function openStockDialog(row: Row) {
		stockTarget = row;
		stockError = '';
		stockDialog.showModal();
	}

	function recordHref(row: Row): string {
		return `/o/${data.organization.slug}/${data.objectType.slug}/${row.id}`;
	}

	function onRowKeydown(e: KeyboardEvent, row: Row) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			goto(recordHref(row));
		}
	}

	function displayValue(field: Field, value: unknown): string {
		if (value === undefined || value === null || value === '') return '—';
		if (field.dataType === 'boolean') return value ? 'Yes' : 'No';
		if (field.dataType === 'select') {
			return field.selectOptions?.find((o) => o.value === value)?.label ?? String(value);
		}
		if (field.dataType === 'user_reference') {
			return orgUserNames.get(String(value)) ?? String(value);
		}
		if (field.dataType === 'reference') {
			return lookupNames.get(String(value)) ?? String(value);
		}
		return String(value);
	}

	function locationValue(row: Row): string {
		const c = data.checkoutsByRecordId.get(row.id);
		if (c?.assignedToLocation) return c.assignedToLocation.name;
		const defaultLoc = data.locations.find((l) => l.id === row.defaultLocationId);
		return defaultLoc?.name ?? '—';
	}

	function baseParams(): URLSearchParams {
		const params = new URLSearchParams();
		if (data.search) params.set('q', data.search);
		if (data.filterKey && data.filterValue) {
			params.set('filterKey', data.filterKey);
			params.set('filterValue', data.filterValue);
		}
		if (data.status) params.set('status', data.status);
		return params;
	}

	function sortUrl(fieldKey: string): string {
		const params = baseParams();
		const nextDir = data.sortKey === fieldKey && data.sortDirection === 'asc' ? 'desc' : 'asc';
		params.set('sort', fieldKey);
		params.set('dir', nextDir);
		return `?${params.toString()}`;
	}

	function pageUrl(page: number): string {
		const params = baseParams();
		if (data.sortKey) {
			params.set('sort', data.sortKey);
			params.set('dir', data.sortDirection);
		}
		params.set('page', String(page));
		return `?${params.toString()}`;
	}

	const exportUrl = $derived.by(() => {
		const params = baseParams();
		if (data.sortKey) {
			params.set('sort', data.sortKey);
			params.set('dir', data.sortDirection);
		}
		for (const key of allColumns.map((c) => c.key)) {
			if (visibleColumns.has(key)) params.append('cols', key);
		}
		return `/o/${data.organization.slug}/${data.objectType.slug}/export.csv?${params.toString()}`;
	});

	const totalPages = $derived(Math.max(Math.ceil(data.total / data.pageSize), 1));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold">{data.objectType.name}</h1>
			<p class="text-base-content/60 text-sm">{data.total} record{data.total === 1 ? '' : 's'}</p>
		</div>
		{#if !isMember}
			<div class="flex gap-2">
				<a href={`/o/${data.organization.slug}/${data.objectType.slug}/import`} class="btn btn-outline">
					<Upload size={16} />
					Import CSV
				</a>
				<a href={exportUrl} data-sveltekit-reload class="btn btn-outline">
					<Download size={16} />
					Export CSV
				</a>
				<a href={`/o/${data.organization.slug}/${data.objectType.slug}/new`} class="btn btn-primary">
					<Plus size={16} />
					{newLabel}
				</a>
			</div>
		{/if}
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<div class="flex items-start justify-between gap-3">
		<form method="get" class="flex min-w-0 flex-1 flex-wrap items-end gap-3">
			<label class="input">
				<Search size={16} class="opacity-50" />
				<input type="text" name="q" placeholder="Search records" value={data.search} />
			</label>
			<select name="status" class="select w-auto">
				<option value="">All statuses</option>
				<option value="available" selected={data.status === 'available'}>Available</option>
				<option value="checked_out" selected={data.status === 'checked_out'}>Checked out</option>
				<option value="archived" selected={data.status === 'archived'}>Archived</option>
			</select>
			{#if filterableFields.length > 0}
				<select name="filterKey" class="select w-auto">
					<option value="">No filter</option>
					{#each filterableFields as field (field.id)}
						<option value={field.key} selected={data.filterKey === field.key}>{field.label}</option>
					{/each}
				</select>
				<input
					type="text"
					name="filterValue"
					placeholder="Filter value"
					value={data.filterValue}
					class="input w-auto"
				/>
			{/if}
			<button type="submit" class="btn btn-ghost">Apply</button>
		</form>

		<details class="dropdown dropdown-end shrink-0">
			<summary class="btn btn-ghost btn-sm">
				<Columns3 size={16} />
				Columns
			</summary>
			<ul class="dropdown-content menu bg-base-100 rounded-box z-10 w-64 gap-0.5 p-2 shadow">
				<li class="menu-title text-xs">Pin keeps one column visible while scrolling</li>
				{#each allColumns as col (col.key)}
					{@const isLastOne = visibleColumns.size === 1 && visibleColumns.has(col.key)}
					<li>
						<div class="flex items-center justify-between gap-2 px-1">
							<label class="label cursor-pointer justify-start gap-2" class:opacity-50={isLastOne}>
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={visibleColumns.has(col.key)}
									disabled={isLastOne}
									onchange={(e) => toggleColumn(col.key, e.currentTarget.checked)}
								/>
								<span class="label-text">{col.label}</span>
							</label>
							{#if visibleColumns.has(col.key)}
								<button
									type="button"
									class="btn btn-ghost btn-xs btn-square {pinnedColumn === col.key ? 'text-primary' : 'opacity-40'}"
									title={pinnedColumn === col.key ? `Unpin ${col.label}` : `Pin ${col.label} to stay visible`}
									onclick={() => togglePin(col.key)}
								>
									<Pin size={13} />
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</details>
	</div>

	<div class="card bg-base-100 shadow">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						{#each visibleFields as field (field.id)}
							<th class="whitespace-nowrap {pinnedClass(field.key)}">
								{#if field.storageSlot}
									<a href={sortUrl(field.key)} class="flex items-center gap-1 hover:underline">
										{field.label}
										{#if data.sortKey === field.key}
											{#if data.sortDirection === 'asc'}
												<ArrowUp size={12} />
											{:else}
												<ArrowDown size={12} />
											{/if}
										{/if}
									</a>
								{:else}
									{field.label}
								{/if}
							</th>
						{/each}
						{#if hasLocationColumn && visibleColumns.has('location')}
							<th class="whitespace-nowrap {pinnedClass('location')}">Location</th>
						{/if}
						{#if visibleColumns.has('status')}
							<th class="whitespace-nowrap {pinnedClass('status')}">
								{isMember ? 'Request' : kind === 'consumable' ? 'Actions' : 'Status'}
							</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr
							class="hover group cursor-pointer"
							tabindex="0"
							onclick={() => goto(recordHref(row))}
							onkeydown={(e) => onRowKeydown(e, row)}
						>
							{#each visibleFields as field (field.id)}
								<td class="group-hover:text-primary max-w-[16rem] align-top wrap-break-word whitespace-normal transition-colors {pinnedClass(field.key)}">
									{displayValue(field, row.data.values[field.key])}
								</td>
							{/each}
							{#if hasLocationColumn && visibleColumns.has('location')}
								<td class="group-hover:text-primary whitespace-nowrap transition-colors {pinnedClass('location')}">
									{locationValue(row)}
								</td>
							{/if}
							{#if visibleColumns.has('status')}
								<td class={pinnedClass('status')}>
									{#if isMember}
										{#if data.myPendingRequestRecordIds.has(row.id)}
											<span class="badge badge-ghost badge-sm">Requested</span>
										{:else if isRequestable(row)}
											<form method="post" action="?/request" use:enhance>
												<input type="hidden" name="recordId" value={row.id} />
												<button
													type="submit"
													class="btn btn-outline btn-xs"
													onclick={(e) => e.stopPropagation()}
												>
													Request
												</button>
											</form>
										{:else}
											<span class="text-base-content/40 text-xs">
												{(row.requestableOverride ?? data.objectType.requestable) ? 'Not available' : 'Requests disabled'}
											</span>
										{/if}
									{:else if kind === 'consumable'}
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											onclick={(e) => {
												e.stopPropagation();
												openStockDialog(row);
											}}
										>
											<PackagePlus size={14} />
											Add stock
										</button>
									{:else}
										{@const pendingAccept =
											row.status === 'checked_out' &&
											data.checkoutsByRecordId.get(row.id)?.assignedToUserId &&
											!data.checkoutsByRecordId.get(row.id)?.acceptedAt}
										<span
											class="badge badge-sm whitespace-nowrap capitalize {recordStatusBadgeClass(row.status)} {pendingAccept ? 'gap-1 pl-1.5' : ''}"
										>
											{#if pendingAccept}
												<div class="tooltip" data-tip="Awaiting receipt confirmation">
													<Clock size={12} />
												</div>
											{/if}
											{row.status.replace('_', ' ')}
										</span>
									{/if}
								</td>
							{/if}
						</tr>
					{:else}
						<tr>
							<td
								colspan={visibleFields.length + (hasLocationColumn && visibleColumns.has('location') ? 1 : 0) + (visibleColumns.has('status') ? 1 : 0)}
								class="text-base-content/60"
							>
								No records yet.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	{#if totalPages > 1}
		<div class="join flex justify-center">
			{#each Array(totalPages) as _, i (i)}
				<a
					href={pageUrl(i + 1)}
					class="join-item btn btn-sm {data.page === i + 1 ? 'btn-active' : ''}"
				>
					{i + 1}
				</a>
			{/each}
		</div>
	{/if}
</div>

<dialog bind:this={stockDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Add stock{stockTarget ? ` — ${stockTarget.data.values.name}` : ''}</h3>
		<form
			method="post"
			action="?/addStock"
			use:enhance={() => {
				stockError = '';
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						stockError = (result.data?.message as string) ?? 'Could not add stock';
					} else {
						await update();
						stockDialog.close();
					}
				};
			}}
			class="mt-4 space-y-4"
		>
			<input type="hidden" name="recordId" value={stockTarget?.id ?? ''} />
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Amount to add</legend>
				<input type="number" name="amount" min="1" value="1" required class="input w-full" />
				<p class="text-base-content/50 text-xs">
					Current total: {Number(stockTarget?.data.values.quantity) || 0}
				</p>
			</fieldset>
			{#if stockError}
				<div class="alert alert-error text-sm">
					<span>{stockError}</span>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => stockDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary">Add stock</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
