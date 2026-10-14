<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Layers, Lock, Package, Pencil, Plus, Trash, X } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let fieldDialog: HTMLDialogElement;
	let deleteDialog: HTMLDialogElement;

	type Field = PageServerData['objectType']['fields'][number];

	let editingField = $state<Field | null>(null);
	let dataType = $state<Field['dataType']>('text');
	let fieldToDelete = $state<Field | null>(null);

	const labelFieldOptions = $derived(
		data.objectType.fields.filter((f) => f.dataType === 'text' || f.dataType === 'number')
	);
	const MAX_LABEL_FIELDS = 3;
	let selectedLabelKeys = $state<string[]>(untrack(() => [...(data.objectType.barcodeFieldKeys ?? [])]));

	const isBulkCustomType = $derived(data.objectType.builtinKind === 'custom' && data.objectType.trackingMode === 'bulk');
	const isIndividualCustomType = $derived(
		data.objectType.builtinKind === 'custom' && data.objectType.trackingMode === 'individual'
	);
	const numberFieldOptions = $derived(data.objectType.fields.filter((f) => f.dataType === 'number'));

	function toggleLabelKey(key: string, checked: boolean) {
		if (checked) {
			if (selectedLabelKeys.length >= MAX_LABEL_FIELDS) return;
			selectedLabelKeys = [...selectedLabelKeys, key];
		} else {
			selectedLabelKeys = selectedLabelKeys.filter((k) => k !== key);
		}
	}

	const dataTypeOptions = [
		{ value: 'text', label: 'Text' },
		{ value: 'number', label: 'Number' },
		{ value: 'date', label: 'Date' },
		{ value: 'boolean', label: 'Yes / No' },
		{ value: 'select', label: 'Select (single choice)' },
		{ value: 'user_reference', label: 'User' }
	] as const;

	function openCreateField() {
		editingField = null;
		dataType = 'text';
		fieldDialog.showModal();
	}

	function openEditField(field: Field) {
		editingField = field;
		dataType = field.dataType;
		fieldDialog.showModal();
	}

	function openDeleteField(field: Field) {
		fieldToDelete = field;
		deleteDialog.showModal();
	}

	$effect(() => {
		if (form?.success) {
			fieldDialog?.close();
			deleteDialog?.close();
		}
	});
</script>

<div class="space-y-8">
	<div>
		<a href="../object-types" class="link link-primary text-sm">&larr; Object types</a>
		<div class="mt-1 flex items-center gap-2">
			<h1 class="text-lg font-semibold">{data.objectType.name}</h1>
			{#if data.objectType.isArchived}
				<span class="badge badge-neutral badge-sm">Archived</span>
			{/if}
			{#if data.objectType.builtinKind === 'custom'}
				<span class="badge badge-ghost badge-sm gap-1">
					{#if data.objectType.trackingMode === 'bulk'}
						<Layers size={11} />
						Tracked in bulk
					{:else}
						<Package size={11} />
						Individually tracked
					{/if}
				</span>
			{/if}
		</div>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<section class="card bg-base-100 shadow">
		<div class="card-body">
			<h2 class="card-title text-base">Settings</h2>
			<form method="post" action="?/updateSettings" use:enhance class="mt-2 space-y-4">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Name</legend>
					<input name="name" required value={data.objectType.name} class="input w-full" />
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Description</legend>
					<textarea name="description" class="textarea w-full" rows="2"
						>{data.objectType.description ?? ''}</textarea
					>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Barcode/QR label fields (up to {MAX_LABEL_FIELDS})</legend>

					{#if selectedLabelKeys.length > 0}
						<div class="mb-2 flex flex-wrap gap-1.5">
							{#each selectedLabelKeys as key (key)}
								<span class="badge badge-outline gap-1">
									{labelFieldOptions.find((f) => f.key === key)?.label ?? key}
									<input type="hidden" name="barcodeFieldKeys" value={key} />
									<button
										type="button"
										class="hover:text-error"
										aria-label={`Remove ${key}`}
										onclick={() => toggleLabelKey(key, false)}
									>
										<X size={12} />
									</button>
								</span>
							{/each}
						</div>
					{/if}

					{#if labelFieldOptions.length === 0}
						<p class="text-base-content/50 text-sm">No text/number fields on this type yet to choose from.</p>
					{:else if selectedLabelKeys.length >= MAX_LABEL_FIELDS}
						<p class="text-base-content/50 text-sm">Maximum of {MAX_LABEL_FIELDS} fields selected.</p>
					{:else}
						<select
							class="select w-full"
							value=""
							onchange={(e) => {
								if (e.currentTarget.value) toggleLabelKey(e.currentTarget.value, true);
								e.currentTarget.value = '';
							}}
						>
							<option value="" disabled>Add a field...</option>
							{#each labelFieldOptions.filter((f) => !selectedLabelKeys.includes(f.key)) as field (field.id)}
								<option value={field.key}>{field.label}</option>
							{/each}
						</select>
					{/if}

					<p class="text-base-content/50 text-xs">
						Each chosen field prints on its own line under this type's record labels — e.g. asset
						tag and serial number. No selection falls back to the record name.
					</p>
				</fieldset>

				{#if isBulkCustomType}
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Quantity field</legend>
						{#if numberFieldOptions.length === 0}
							<p class="text-base-content/50 text-sm">
								Add a number field below first (e.g. "Seats"), then come back and designate it here.
							</p>
						{:else}
							<select name="quantityFieldKey" class="select w-full" value={data.objectType.quantityFieldKey ?? ''}>
								<option value="" disabled>Choose which field holds the total quantity</option>
								{#each numberFieldOptions as field (field.id)}
									<option value={field.key}>{field.label}</option>
								{/each}
							</select>
						{/if}
						<p class="text-base-content/50 text-xs">
							Which number field represents how many units this record has in total — checkouts,
							availability, and check-in all read from it instead of a hardcoded "Quantity" field.
						</p>
					</fieldset>
				{/if}

				{#if isIndividualCustomType}
					<label class="label cursor-pointer justify-start gap-2">
						<input
							type="checkbox"
							name="allowComponentInstall"
							class="checkbox checkbox-sm"
							checked={data.objectType.allowComponentInstall}
						/>
						<span class="label-text">Components can be installed into records of this type</span>
					</label>
				{/if}

				{#if data.objectType.builtinKind !== 'component'}
					<label class="label cursor-pointer justify-start gap-2">
						<input
							type="checkbox"
							name="requestable"
							class="checkbox checkbox-sm"
							checked={data.objectType.requestable}
						/>
						<span class="label-text">Members can request items of this type</span>
					</label>
				{/if}

					<button type="submit" class="btn btn-primary btn-sm">Save</button>
				</form>
				{#if data.objectType.builtinKind === 'custom'}
					<div class="border-base-300 mt-4 flex items-center justify-between border-t pt-4">
						<p class="text-base-content/60 text-sm">
							{data.objectType.isArchived
								? 'This object type is archived and hidden from new-record forms.'
								: 'Archiving hides this object type without deleting its data.'}
						</p>
						<form method="post" action="?/setArchived" use:enhance>
							<input type="hidden" name="archived" value={(!data.objectType.isArchived).toString()} />
							{#if data.objectType.isArchived}
								<button type="submit" class="btn btn-ghost btn-sm">
									<ArchiveRestore size={16} />
									Unarchive
								</button>
							{:else}
								<button type="submit" class="btn btn-ghost btn-sm text-error">
									<Archive size={16} />
									Archive
								</button>
							{/if}
						</form>
					</div>
				{:else}
					<div class="border-base-300 mt-4 border-t pt-4">
						<p class="text-base-content/50 text-sm">
							This is a built-in object type and can't be archived or removed.
						</p>
					</div>
				{/if}
		</div>
	</section>

	<section class="space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="font-medium">Fields</h2>
			<button class="btn btn-primary btn-sm" onclick={openCreateField}>
				<Plus size={16} />
				Add field
			</button>
		</div>

		<div class="card bg-base-100 shadow">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Label</th>
							<th>Key</th>
							<th>Type</th>
							<th></th>
							<th class="text-center" title="Fast filtering in the record list">Filterable</th>
							<th class="text-center" title="Available as a report column">Reportable</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.objectType.fields as field, i (field.id)}
							<tr class="hover">
								<td class="font-medium">{field.label}</td>
								<td class="text-base-content/50 font-mono text-xs">{field.key}</td>
								<td>
									<span class="badge badge-ghost badge-sm capitalize">
										{field.dataType.replace('_', ' ')}
									</span>
								</td>
								<td>
									{#if field.required}
										<span class="badge badge-outline badge-sm">Required</span>
									{/if}
									{#if field.systemManaged}
										<span class="badge badge-info badge-sm">System</span>
									{:else if field.isBuiltin}
										<span class="badge badge-ghost badge-sm">Built-in</span>
									{/if}
								</td>
								<td class="text-center">
									<form method="post" action="?/toggleFilterable" use:enhance>
										<input type="hidden" name="fieldId" value={field.id} />
										<input type="hidden" name="next" value={(!field.filterable).toString()} />
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											checked={field.filterable}
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
										/>
									</form>
								</td>
								<td class="text-center">
									<form method="post" action="?/toggleReportable" use:enhance>
										<input type="hidden" name="fieldId" value={field.id} />
										<input type="hidden" name="next" value={(!field.reportable).toString()} />
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											checked={field.reportable}
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
										/>
									</form>
								</td>
								<td>
									<div class="flex items-center justify-end gap-1">
										<form method="post" action="?/moveField" use:enhance>
											<input type="hidden" name="fieldId" value={field.id} />
											<input type="hidden" name="direction" value="up" />
											<button
												type="submit"
												class="btn btn-ghost btn-xs"
												disabled={i === 0}
												aria-label="Move up"
											>
												<ArrowUp size={14} />
											</button>
										</form>
										<form method="post" action="?/moveField" use:enhance>
											<input type="hidden" name="fieldId" value={field.id} />
											<input type="hidden" name="direction" value="down" />
											<button
												type="submit"
												class="btn btn-ghost btn-xs"
												disabled={i === data.objectType.fields.length - 1}
												aria-label="Move down"
											>
												<ArrowDown size={14} />
											</button>
										</form>
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											aria-label="Edit field"
											onclick={() => openEditField(field)}
										>
											<Pencil size={14} />
										</button>
										{#if field.locked}
											<span
												class="btn btn-ghost btn-xs text-base-content/30 cursor-not-allowed"
												title="Required field — can't be removed"
											>
												<Lock size={14} />
											</span>
										{:else}
											<button
												type="button"
												class="btn btn-ghost btn-xs text-error"
												aria-label="Delete field"
												onclick={() => openDeleteField(field)}
											>
												<Trash size={14} />
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{:else}
							<tr><td colspan="7" class="text-base-content/60">No fields yet.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</section>
</div>

<dialog bind:this={fieldDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">{editingField ? 'Edit field' : 'Add field'}</h3>

		<form
			method="post"
			action={editingField ? '?/updateField' : '?/addField'}
			use:enhance
			class="mt-4 space-y-4"
		>
			{#if editingField}
				<input type="hidden" name="fieldId" value={editingField.id} />
			{/if}
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Label</legend>
				<input name="label" required value={editingField?.label ?? ''} class="input w-full" />
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Type</legend>
				{#if editingField}
					<input class="input w-full capitalize" value={editingField.dataType.replace('_', ' ')} disabled />
					<p class="text-base-content/50 text-xs">Field type can't be changed after creation.</p>
				{:else}
					<select name="dataType" class="select w-full" bind:value={dataType}>
						{#each dataTypeOptions as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				{/if}
			</fieldset>
			{#if dataType === 'select'}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Options (one per line)</legend>
					<textarea
						name="selectOptions"
						class="textarea w-full"
						rows="4"
						placeholder={'Available\nChecked out\nIn repair'}
						>{editingField?.selectOptions?.map((o) => o.label).join('\n') ?? ''}</textarea
					>
				</fieldset>
			{/if}
			<label class="label gap-2">
				<input type="checkbox" name="required" class="checkbox checkbox-sm" checked={editingField?.required} />
				Required
			</label>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => fieldDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary">{editingField ? 'Save' : 'Add field'}</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<dialog bind:this={deleteDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Delete field?</h3>
		<p class="text-base-content/60 mt-2 text-sm">
			This removes "{fieldToDelete?.label}" from this object type. This can't be undone.
		</p>
		<form method="post" action="?/deleteField" use:enhance class="modal-action">
			<input type="hidden" name="fieldId" value={fieldToDelete?.id ?? ''} />
			<button type="button" class="btn" onclick={() => deleteDialog.close()}>Cancel</button>
			<button type="submit" class="btn btn-error">Delete</button>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
