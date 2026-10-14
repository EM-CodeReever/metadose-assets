<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleX, Download, Upload } from '@lucide/svelte';
	import { downloadCsvTemplate } from '$lib/csvTemplate';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const editableFields = $derived(data.objectType.fields.filter((f) => !f.systemManaged));

	/** One sensible example value per field type, so the downloaded template isn't just bare headers. */
	function exampleValueFor(field: (typeof editableFields)[number]): string {
		switch (field.dataType) {
			case 'boolean':
				return 'yes';
			case 'number':
				return '0';
			case 'date':
				return new Date().toISOString().slice(0, 10);
			case 'select':
				return field.selectOptions?.[0]?.label ?? '';
			default:
				return '';
		}
	}

	function downloadTemplate() {
		downloadCsvTemplate(
			`${data.objectType.slug}-template.csv`,
			editableFields.map((f) => f.label),
			editableFields.map(exampleValueFor)
		);
	}

	let fileInput: HTMLInputElement;
	let fileName = $state('');
	let parseError = $state('');
	let csvHeaders = $state<string[]>([]);
	let csvRows = $state<Record<string, string>[]>([]);
	let mapping = $state<Record<string, string>>({});
	let submitting = $state(false);

	const previewRows = $derived(csvRows.slice(0, 5));

	function autoMapHeader(header: string): string {
		const normalized = header.trim().toLowerCase();
		const match = editableFields.find(
			(f) => f.label.toLowerCase() === normalized || f.key.toLowerCase() === normalized
		);
		return match?.key ?? '';
	}

	async function onFileChange(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		parseError = '';
		csvHeaders = [];
		csvRows = [];
		mapping = {};
		if (!file) return;
		fileName = file.name;

		const Papa = (await import('papaparse')).default;
		Papa.parse<Record<string, string>>(file, {
			header: true,
			skipEmptyLines: true,
			complete: (results) => {
				if (results.errors.length > 0) {
					parseError = results.errors[0].message;
					return;
				}
				const headers = results.meta.fields ?? [];
				if (headers.length === 0) {
					parseError = 'Could not find a header row in this file';
					return;
				}
				csvHeaders = headers;
				csvRows = results.data;
				mapping = Object.fromEntries(headers.map((h) => [h, autoMapHeader(h)]));
			},
			error: (err) => {
				parseError = err.message;
			}
		});
	}

	const mappedFieldKeys = $derived(new Set(Object.values(mapping).filter(Boolean)));
	const unmappedRequired = $derived(editableFields.filter((f) => f.required && !mappedFieldKeys.has(f.key)));

	const rowsJson = $derived(JSON.stringify(csvRows));
	const mappingJson = $derived(JSON.stringify(mapping));
</script>

<div class="mx-auto max-w-4xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<a
			href={`/o/${data.organization.slug}/${data.objectType.slug}`}
			class="link link-primary text-sm"
		>
			&larr; {data.objectType.name}
		</a>
		<h1 class="text-lg font-semibold">Import {data.objectType.name}</h1>
		<p class="text-base-content/60 text-sm">Upload a CSV, map its columns to fields, then import.</p>
	</div>

	<div class="card bg-base-100 shadow">
		<div class="card-body space-y-4">
			<div class="flex items-end justify-between gap-3">
				<fieldset class="fieldset flex-1">
					<legend class="fieldset-legend">CSV file</legend>
					<input
						bind:this={fileInput}
						type="file"
						accept=".csv,text/csv"
						class="file-input w-full"
						onchange={onFileChange}
					/>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend" aria-hidden="true">&nbsp;</legend>
					<button type="button" class="btn btn-outline" onclick={downloadTemplate}>
						<Download size={16} />
						Download CSV template
					</button>
				</fieldset>
			</div>

			{#if parseError}
				<div class="alert alert-error text-sm">
					<span>{parseError}</span>
				</div>
			{/if}

			{#if csvHeaders.length > 0}
				<p class="text-base-content/60 text-sm">
					{fileName} — {csvRows.length} row{csvRows.length === 1 ? '' : 's'} found.
				</p>

				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>CSV column</th>
								<th>Sample value</th>
								<th>Maps to</th>
							</tr>
						</thead>
						<tbody>
							{#each csvHeaders as header (header)}
								<tr>
									<td class="font-medium">{header}</td>
									<td class="text-base-content/60 max-w-48 truncate text-sm">
										{csvRows[0]?.[header] ?? ''}
									</td>
									<td>
										<select class="select select-sm w-auto" bind:value={mapping[header]}>
											<option value="">Don't import</option>
											{#each editableFields as field (field.id)}
												<option value={field.key}>{field.label}</option>
											{/each}
										</select>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if unmappedRequired.length > 0}
					<div class="alert alert-warning text-sm">
						<span>
							These required fields aren't mapped yet: {unmappedRequired.map((f) => f.label).join(', ')}
						</span>
					</div>
				{/if}

				<div>
					<h3 class="mb-2 text-sm font-medium">Preview (first {previewRows.length})</h3>
					<div class="overflow-x-auto">
						<table class="table">
							<thead>
								<tr>
									{#each csvHeaders as header (header)}
										<th>{header}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each previewRows as row, i (i)}
									<tr>
										{#each csvHeaders as header (header)}
											<td>{row[header]}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				{#if form?.message}
					<div class="alert alert-error text-sm">
						<span>{form.message}</span>
					</div>
				{/if}

				{#if form?.success}
					<div class="alert {form.failed > 0 ? 'alert-warning' : 'alert-success'} text-sm">
						<span>
							Imported {form.created} record{form.created === 1 ? '' : 's'}.
							{#if form.failed > 0}{form.failed} row{form.failed === 1 ? '' : 's'} failed.{/if}
						</span>
					</div>
					{#if form.errors.length > 0}
						<ul class="divide-base-300 divide-y text-sm">
							{#each form.errors as err (err.row)}
								<li class="flex items-start gap-2 py-2">
									<CircleX size={14} class="text-error mt-0.5 shrink-0" />
									<span>Row {err.row}: {err.message}</span>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}

				<form
					method="post"
					action="?/import"
					use:enhance={() => {
						submitting = true;
						return async ({ update }) => {
							submitting = false;
							await update();
						};
					}}
				>
					<input type="hidden" name="mapping" value={mappingJson} />
					<input type="hidden" name="rows" value={rowsJson} />
					<button type="submit" class="btn btn-primary" disabled={submitting || unmappedRequired.length > 0}>
						{#if submitting}
							Importing...
						{:else}
							<Upload size={16} />
							Import {csvRows.length} record{csvRows.length === 1 ? '' : 's'}
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
