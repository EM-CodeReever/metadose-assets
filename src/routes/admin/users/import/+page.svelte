<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleX, Download, Upload } from '@lucide/svelte';
	import { downloadCsvTemplate } from '$lib/csvTemplate';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const ROLE_OPTIONS = ['owner', 'admin', 'manager', 'viewer', 'member'];

	let fileName = $state('');
	let parseError = $state('');
	let csvRows = $state<{ name: string; email: string }[]>([]);
	let organizationId = $state('');
	let role = $state('member');
	let submitting = $state(false);

	const previewRows = $derived(csvRows.slice(0, 5));
	const rowsJson = $derived(JSON.stringify(csvRows));

	function downloadTemplate() {
		downloadCsvTemplate('users-template.csv', ['name', 'email'], ['Jane Doe', 'jane.doe@example.com']);
	}

	async function onFileChange(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		parseError = '';
		csvRows = [];
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
				const headers = (results.meta.fields ?? []).map((h) => h.trim().toLowerCase());
				if (!headers.includes('name') || !headers.includes('email')) {
					parseError = 'The CSV needs "name" and "email" columns';
					return;
				}
				csvRows = results.data.map((row) => {
					const entries = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]));
					return { name: entries.name ?? '', email: entries.email ?? '' };
				});
			},
			error: (err) => {
				parseError = err.message;
			}
		});
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<a href="/admin/users" class="link link-primary text-sm">&larr; Users</a>
		<h1 class="text-lg font-semibold">Bulk import users</h1>
		<p class="text-base-content/60 text-sm">
			Upload a CSV with "name" and "email" columns. New users get a random password and an
			email to set their own; existing emails are matched and left alone.
		</p>
	</div>

	<div class="card bg-base-100 shadow">
		<div class="card-body space-y-4">
			<div class="flex items-end justify-between gap-3">
				<fieldset class="fieldset flex-1">
					<legend class="fieldset-legend">CSV file</legend>
					<input type="file" accept=".csv,text/csv" class="file-input w-full" onchange={onFileChange} />
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

			{#if csvRows.length > 0}
				<p class="text-base-content/60 text-sm">
					{fileName} — {csvRows.length} row{csvRows.length === 1 ? '' : 's'} found.
				</p>

				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr><th>Name</th><th>Email</th></tr>
						</thead>
						<tbody>
							{#each previewRows as row, i (i)}
								<tr><td>{row.name}</td><td>{row.email}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="border-base-300 flex flex-wrap items-end gap-3 border-t pt-4">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Add everyone to organization (optional)</legend>
						<select bind:value={organizationId} class="select w-56">
							<option value="">Don't add to an organization</option>
							{#each data.organizations as org (org.id)}
								<option value={org.id}>{org.name}</option>
							{/each}
						</select>
					</fieldset>
					{#if organizationId}
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Role</legend>
							<select bind:value={role} class="select w-40">
								{#each ROLE_OPTIONS as r (r)}
									<option value={r}>{r}</option>
								{/each}
							</select>
						</fieldset>
					{/if}
				</div>

				{#if form?.message}
					<div class="alert alert-error text-sm">
						<span>{form.message}</span>
					</div>
				{/if}

				{#if form?.success}
					<div class="alert {form.failed > 0 ? 'alert-warning' : 'alert-success'} text-sm">
						<span>
							Created/added {form.created} user{form.created === 1 ? '' : 's'}.
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
					<input type="hidden" name="rows" value={rowsJson} />
					<input type="hidden" name="organizationId" value={organizationId} />
					<input type="hidden" name="role" value={role} />
					<button type="submit" class="btn btn-primary" disabled={submitting}>
						{#if submitting}
							Importing...
						{:else}
							<Upload size={16} />
							Import {csvRows.length} user{csvRows.length === 1 ? '' : 's'}
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
