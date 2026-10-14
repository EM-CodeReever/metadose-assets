<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		Check,
		ChevronDown,
		Columns3,
		Download,
		Filter,
		Pencil,
		Plus,
		SlidersHorizontal,
		Trash2
	} from '@lucide/svelte';
	import {
		CREATED_AT_FIELD_KEY,
		STATUS_FIELD_KEY,
		STATUS_OPTIONS,
		describeFilter,
		filterFieldType,
		operatorsFor,
		valueKindFor,
		type FilterCondition
	} from '$lib/reportFilters';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	type Field = PageServerData['report']['objectType']['fields'][number];
	type Row = Extract<PageServerData['result'], { mode: 'detail' }>['rows'][number];

	const realFields = $derived(data.report.objectType.fields.filter((f) => !f.systemManaged));

	interface FieldOption {
		key: string;
		label: string;
	}
	const fieldOptions = $derived<FieldOption[]>([
		{ key: STATUS_FIELD_KEY, label: 'Status' },
		{ key: CREATED_AT_FIELD_KEY, label: 'Created' },
		...realFields.map((f) => ({ key: f.key, label: f.label }))
	]);

	function fieldLabel(key: string): string {
		return fieldOptions.find((f) => f.key === key)?.label ?? key;
	}

	function fieldTypeFor(fieldKey: string) {
		if (fieldKey === STATUS_FIELD_KEY) return 'status' as const;
		if (fieldKey === CREATED_AT_FIELD_KEY) return 'date' as const;
		const field = realFields.find((f) => f.key === fieldKey);
		return field ? filterFieldType(field.dataType) : ('text' as const);
	}

	type WidgetKind = 'text' | 'number' | 'date' | 'boolean' | 'options';
	function widgetKindFor(fieldKey: string): WidgetKind {
		if (fieldKey === STATUS_FIELD_KEY) return 'options';
		const field = realFields.find((f) => f.key === fieldKey);
		if (!field) return 'text';
		if (field.dataType === 'number') return 'number';
		if (field.dataType === 'date') return 'date';
		if (field.dataType === 'boolean') return 'boolean';
		if (field.dataType === 'select' || field.dataType === 'user_reference' || field.dataType === 'reference') {
			return 'options';
		}
		return 'text';
	}

	function valueOptionsFor(fieldKey: string): { value: string; label: string }[] {
		if (fieldKey === STATUS_FIELD_KEY) return STATUS_OPTIONS;
		const field = realFields.find((f) => f.key === fieldKey);
		if (!field) return [];
		if (field.dataType === 'select') return field.selectOptions ?? [];
		if (field.dataType === 'user_reference') return data.orgUsers.map((u) => ({ value: u.id, label: u.name }));
		if (field.dataType === 'reference') {
			const kind = field.referenceKind as keyof typeof data.lookupValues;
			return (data.lookupValues[kind] ?? []).map((v) => ({ value: v.id, label: v.name }));
		}
		return [];
	}

	function resolveValueLabel(fieldKey: string, raw: string): string {
		const options = valueOptionsFor(fieldKey);
		if (options.length > 0) return options.find((o) => o.value === raw)?.label ?? raw;
		if (widgetKindFor(fieldKey) === 'boolean') return raw === 'true' ? 'Yes' : 'No';
		return raw;
	}

	let filters = $state<FilterCondition[]>(
		untrack(() => data.report.config.filters.map((f) => ({ ...f, values: f.values ? [...f.values] : [] })))
	);
	let columns = $state<string[]>(untrack(() => [...data.report.config.columns]));
	let sortKey = $state(untrack(() => data.report.config.sortKey ?? ''));
	let sortDirection = $state<'asc' | 'desc'>(untrack(() => data.report.config.sortDirection ?? 'desc'));
	let groupBy = $state(untrack(() => data.report.config.groupBy ?? ''));
	let aggregateField = $state(untrack(() => data.report.config.aggregateField ?? ''));
	let builderOpen = $state(false);
	let renameOpen = $state(false);

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}

	function addFilter() {
		const firstField = fieldOptions[0];
		const op = operatorsFor(fieldTypeFor(firstField.key))[0];
		filters = [
			...filters,
			{ id: crypto.randomUUID(), fieldKey: firstField.key, operator: op.value, value: '', values: [] }
		];
	}

	function removeFilter(id: string) {
		filters = filters.filter((f) => f.id !== id);
	}

	function onFieldChange(condition: FilterCondition) {
		const ops = operatorsFor(fieldTypeFor(condition.fieldKey));
		if (!ops.some((o) => o.value === condition.operator)) {
			condition.operator = ops[0].value;
		}
	}

	function toggleColumn(key: string, checked: boolean) {
		columns = checked ? [...columns, key] : columns.filter((c) => c !== key);
	}

	const numberFields = $derived(realFields.filter((f) => f.dataType === 'number'));

	const orgUserNames = $derived(new Map(data.orgUsers.map((u) => [u.id, u.name])));
	const lookupNames = $derived(new Map(Object.values(data.lookupValues).flat().map((v) => [v.id, v.name])));

	const displayColumns = $derived(
		columns.length > 0 ? columns : [STATUS_FIELD_KEY, ...realFields.map((f) => f.key)]
	);

	function displayValue(field: Field, value: unknown): string {
		if (value === undefined || value === null || value === '') return '—';
		if (field.dataType === 'boolean') return value ? 'Yes' : 'No';
		if (field.dataType === 'select') {
			return field.selectOptions?.find((o) => o.value === value)?.label ?? String(value);
		}
		if (field.dataType === 'user_reference') return orgUserNames.get(String(value)) ?? String(value);
		if (field.dataType === 'reference') return lookupNames.get(String(value)) ?? String(value);
		return String(value);
	}

	function cellValue(col: string, row: Row): string {
		if (col === STATUS_FIELD_KEY) return row.status.replace('_', ' ');
		if (col === CREATED_AT_FIELD_KEY) return new Date(row.createdAt).toLocaleDateString();
		const field = realFields.find((f) => f.key === col);
		return field ? displayValue(field, row.data.values[col]) : '—';
	}

	function isNumericColumn(col: string): boolean {
		return realFields.find((f) => f.key === col)?.dataType === 'number';
	}

	const filtersJson = $derived(JSON.stringify(filters));
	const generatedAt = new Date();

	const exportUrl = $derived(`/o/${data.organization.slug}/reports/${data.report.id}/export.csv`);
</script>

<div class="mx-auto max-w-6xl space-y-6 2xl:max-w-[1600px]">
	<!-- Report letterhead -->
	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<div class="card-body gap-1 py-5">
			<div class="flex items-start justify-between gap-4">
				<div>
					<a href={`/o/${data.organization.slug}/reports`} class="link link-primary text-xs">
						&larr; All reports
					</a>
					<div class="mt-1 flex items-center gap-2">
						{#if renameOpen}
							<form
								method="post"
								action="?/rename"
								use:enhance={() => async ({ update }) => {
									renameOpen = false;
									await update();
								}}
								class="flex items-center gap-2"
							>
								<input
									name="name"
									value={data.report.name}
									required
									class="input input-sm"
									use:focusOnMount
								/>
								<button type="submit" class="btn btn-primary btn-xs">Save</button>
								<button type="button" class="btn btn-ghost btn-xs" onclick={() => (renameOpen = false)}>
									Cancel
								</button>
							</form>
						{:else}
							<h1 class="text-xl font-bold tracking-tight uppercase">{data.report.name}</h1>
							<button
								type="button"
								class="btn btn-ghost btn-xs"
								aria-label="Rename report"
								onclick={() => (renameOpen = true)}
							>
								<Pencil size={12} />
							</button>
						{/if}
					</div>
					<p class="text-base-content/50 mt-0.5 text-xs tracking-wide uppercase">
						{data.report.objectType.name} · {data.organization.name}
					</p>
				</div>
				<div class="text-right">
					<a href={exportUrl} data-sveltekit-reload class="btn btn-outline btn-sm">
						<Download size={14} />
						Export CSV
					</a>
					<p class="text-base-content/40 mt-2 text-xs">
						Generated {generatedAt.toLocaleDateString()} {generatedAt.toLocaleTimeString()}
					</p>
				</div>
			</div>

			<!-- Criteria summary -->
			<div class="border-base-300 mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
				<Filter size={13} class="text-base-content/40" />
				{#if filters.length === 0}
					<span class="text-base-content/50 text-xs">No filters — showing all records</span>
				{:else}
					{#each filters as condition, i (condition.id)}
						{#if i > 0}<span class="text-base-content/40 text-xs font-semibold">AND</span>{/if}
						<span class="badge badge-outline badge-sm font-normal">
							{describeFilter(condition, fieldLabel(condition.fieldKey), (v) =>
								resolveValueLabel(condition.fieldKey, v)
							)}
						</span>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<!-- Builder -->
	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<button
			type="button"
			class="flex w-full items-center justify-between gap-2 px-6 py-4 text-left"
			onclick={() => (builderOpen = !builderOpen)}
		>
			<span class="flex items-center gap-2 text-sm font-semibold">
				<SlidersHorizontal size={15} />
				Report builder
			</span>
			<ChevronDown size={16} class="transition-transform {builderOpen ? 'rotate-180' : ''}" />
		</button>

		{#if builderOpen}
			<form method="post" action="?/update" use:enhance class="card-body border-base-300 border-t pt-5">
				<input type="hidden" name="filtersJson" value={filtersJson} />

				<!-- Filters -->
				<section class="space-y-3">
					<h2 class="flex items-center gap-2 text-sm font-semibold">
						<Filter size={14} />
						Filters
					</h2>
					<div class="space-y-2">
						{#each filters as condition (condition.id)}
							{@const type = fieldTypeFor(condition.fieldKey)}
							{@const kind = valueKindFor(type, condition.operator)}
							{@const widget = widgetKindFor(condition.fieldKey)}
							{@const options = valueOptionsFor(condition.fieldKey)}
							<div class="bg-base-200/50 flex flex-wrap items-end gap-2 rounded-lg p-2">
								<select
									name="filterFieldKey"
									class="select select-sm w-40"
									bind:value={condition.fieldKey}
									onchange={() => onFieldChange(condition)}
								>
									{#each fieldOptions as f (f.key)}
										<option value={f.key}>{f.label}</option>
									{/each}
								</select>
								<select name="filterOperator" class="select select-sm w-44" bind:value={condition.operator}>
									{#each operatorsFor(type) as op (op.value)}
										<option value={op.value}>{op.label}</option>
									{/each}
								</select>

								{#if kind === 'single' || kind === 'double'}
									{#if widget === 'options'}
										<select class="select select-sm w-40" bind:value={condition.value}>
											<option value="">Select...</option>
											{#each options as opt (opt.value)}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									{:else if widget === 'boolean'}
										<select class="select select-sm w-32" bind:value={condition.value}>
											<option value="true">Yes</option>
											<option value="false">No</option>
										</select>
									{:else}
										<input
											type={widget === 'number' ? 'number' : widget === 'date' ? 'date' : 'text'}
											placeholder={condition.operator === 'wildcard' ? 'e.g. LT*2024' : ''}
											class="input input-sm w-36"
											bind:value={condition.value}
										/>
									{/if}
								{/if}
								{#if kind === 'double'}
									<span class="text-base-content/50 text-xs">and</span>
									<input
										type={widget === 'number' ? 'number' : 'date'}
										class="input input-sm w-36"
										bind:value={condition.value2}
									/>
								{/if}
								{#if kind === 'multi'}
									<select multiple class="select h-20 w-48" bind:value={condition.values}>
										{#each options as opt (opt.value)}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{/if}

								<button
									type="button"
									class="btn btn-ghost btn-sm text-error ml-auto"
									aria-label="Remove filter"
									onclick={() => removeFilter(condition.id)}
								>
									<Trash2 size={14} />
								</button>
							</div>
						{/each}
					</div>
					<button type="button" class="btn btn-ghost btn-sm" onclick={addFilter}>
						<Plus size={14} />
						Add filter
					</button>
				</section>

				<!-- Columns -->
				<section class="border-base-300 mt-5 space-y-3 border-t pt-5">
					<div class="flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-sm font-semibold">
							<Columns3 size={14} />
							Columns
						</h2>
						<div class="flex items-center gap-2">
							<span class="text-base-content/50 text-xs">
								{columns.length === 0 ? 'Showing all' : `${columns.length} selected`}
							</span>
							{#if columns.length > 0}
								<button type="button" class="link link-primary text-xs" onclick={() => (columns = [])}>
									Clear
								</button>
							{/if}
						</div>
					</div>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
						{#each fieldOptions as f (f.key)}
							{@const active = columns.includes(f.key)}
							<button
								type="button"
								class="btn btn-sm justify-center gap-1.5 normal-case transition-all {active
									? 'btn-primary'
									: 'btn-outline'}"
								aria-pressed={active}
								onclick={() => toggleColumn(f.key, !active)}
							>
								{#if active}<Check size={14} class="shrink-0" />{/if}
								<span class="truncate">{f.label}</span>
							</button>
						{/each}
					</div>
					{#each columns as col (col)}
						<input type="hidden" name="cols" value={col} />
					{/each}
					<p class="text-base-content/50 text-xs">Tap a column to toggle it. None selected shows status + every field.</p>
				</section>

				<!-- Sort & group -->
				<section class="border-base-300 mt-5 flex flex-wrap items-end gap-3 border-t pt-5">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Sort by</legend>
						<select name="sortKey" class="select select-sm w-auto" bind:value={sortKey}>
							<option value="">Newest first</option>
							{#each fieldOptions as f (f.key)}
								<option value={f.key}>{f.label}</option>
							{/each}
						</select>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Direction</legend>
						<select name="sortDir" class="select select-sm w-auto" bind:value={sortDirection}>
							<option value="desc">Descending</option>
							<option value="asc">Ascending</option>
						</select>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Group by</legend>
						<select name="groupBy" class="select select-sm w-auto" bind:value={groupBy}>
							<option value="">None (list each record)</option>
							{#each fieldOptions as f (f.key)}
								<option value={f.key}>{f.label}</option>
							{/each}
						</select>
					</fieldset>
					{#if groupBy && numberFields.length > 0}
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Also sum</legend>
							<select name="aggregateField" class="select select-sm w-auto" bind:value={aggregateField}>
								<option value="">Just count</option>
								{#each numberFields as f (f.id)}
									<option value={f.key}>{f.label}</option>
								{/each}
							</select>
						</fieldset>
					{/if}
					<fieldset class="fieldset ml-auto">
						<legend class="fieldset-legend" aria-hidden="true">&nbsp;</legend>
						<button type="submit" class="btn btn-primary btn-sm">Run report</button>
					</fieldset>
				</section>
			</form>
		{/if}
	</div>

	<!-- Results -->
	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<div class="overflow-x-auto">
			{#if data.result.mode === 'grouped'}
				{@const grouped = data.result}
				<table class="table">
					<thead>
						<tr class="bg-base-200">
							<th class="text-xs font-semibold tracking-wider uppercase">{fieldLabel(grouped.groupBy)}</th>
							<th class="text-right text-xs font-semibold tracking-wider uppercase">Count</th>
							{#if grouped.aggregateField}
								<th class="text-right text-xs font-semibold tracking-wider uppercase">
									Sum of {fieldLabel(grouped.aggregateField)}
								</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each grouped.rows as row (row.group)}
							<tr class="hover">
								<td class="font-medium">{row.group}</td>
								<td class="text-right font-mono">{row.count}</td>
								{#if grouped.aggregateField}
									<td class="text-right font-mono">{row.sum}</td>
								{/if}
							</tr>
						{:else}
							<tr><td colspan={grouped.aggregateField ? 3 : 2} class="text-base-content/60">No data.</td></tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="border-base-300 border-t-2 font-semibold">
							<td>Total</td>
							<td class="text-right font-mono">{grouped.rows.reduce((s, r) => s + r.count, 0)}</td>
							{#if grouped.aggregateField}
								<td class="text-right font-mono">{grouped.rows.reduce((s, r) => s + (r.sum ?? 0), 0)}</td>
							{/if}
						</tr>
					</tfoot>
				</table>
			{:else}
				{@const detail = data.result}
				<table class="table">
					<thead>
						<tr class="bg-base-200">
							{#each displayColumns as col (col)}
								<th class="text-xs font-semibold tracking-wider uppercase {isNumericColumn(col) ? 'text-right' : ''}">
									{fieldLabel(col)}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each detail.rows as row (row.id)}
							<tr class="hover">
								{#each displayColumns as col (col)}
									<td class={isNumericColumn(col) ? 'text-right font-mono' : ''}>{cellValue(col, row)}</td>
								{/each}
							</tr>
						{:else}
							<tr><td colspan={displayColumns.length} class="text-base-content/60">No records match.</td></tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="border-base-300 border-t-2">
							<td colspan={displayColumns.length} class="text-base-content/60 text-xs">
								Showing {detail.rows.length} of {detail.total} matching record{detail.total === 1 ? '' : 's'}
								{#if detail.total > detail.rows.length}
									(capped at {detail.rows.length} — narrow your filters or export CSV for the full set)
								{/if}
							</td>
						</tr>
					</tfoot>
				</table>
			{/if}
		</div>
	</div>
</div>
