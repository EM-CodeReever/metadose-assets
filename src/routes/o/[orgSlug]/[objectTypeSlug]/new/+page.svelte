<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { ImagePlus, Paperclip, X } from '@lucide/svelte';
	import RecordFieldInput from '$lib/components/RecordFieldInput.svelte';
	import UserAssignSelect from '$lib/components/UserAssignSelect.svelte';
	import LocationSelect from '$lib/components/LocationSelect.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const editableFields = $derived(data.objectType.fields.filter((f) => !f.systemManaged));
	const isAsset = $derived(data.rules.targetType === 'user_or_location');

	// Seeded once from a failed submission's re-echo; the user freely changes it afterward.
	let assignMode = $state<'none' | 'user' | 'location'>(
		untrack(() => {
			const v = form?.values?.assignMode;
			return v === 'user' || v === 'location' ? v : 'none';
		})
	);

	let imageFile = $state<File | null>(null);
	let attachmentFiles = $state<File[]>([]);
	let attachmentsInput: HTMLInputElement | undefined = $state();

	function onImageChange(e: Event) {
		imageFile = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
	}

	function onAttachmentsChange(e: Event) {
		attachmentFiles = [...((e.currentTarget as HTMLInputElement).files ?? [])];
	}

	// A native file input's FileList can't have one entry removed directly — rebuild it via
	// DataTransfer and reassign, so what actually gets submitted matches what's displayed.
	function removeAttachment(index: number) {
		attachmentFiles = attachmentFiles.filter((_, i) => i !== index);
		if (attachmentsInput) {
			const dt = new DataTransfer();
			for (const f of attachmentFiles) dt.items.add(f);
			attachmentsInput.files = dt.files;
		}
	}
</script>

<div class="mx-auto max-w-6xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<a
			href={`/o/${data.organization.slug}/${data.objectType.slug}`}
			class="link link-primary text-sm"
		>
			&larr; {data.objectType.name}
		</a>
		<h1 class="text-lg font-semibold">New {data.objectType.name} record</h1>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<form method="post" enctype="multipart/form-data" use:enhance class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="card bg-base-100 shadow lg:col-span-2">
			<div class="card-body">
				<div class="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
					{#each editableFields as field (field.id)}
						<RecordFieldInput
							{field}
							value={form?.values?.[field.key]}
							orgUsers={data.orgUsers}
							lookupValues={data.lookupValues}
							orgSlug={data.organization.slug}
							min={field.key === 'minQuantity' ? 1 : undefined}
						/>
					{/each}
				</div>

				{#if isAsset}
					<div class="border-base-300 mt-4 space-y-4 border-t pt-4">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Assignment</legend>
							<div class="join w-full">
								<input
									type="radio"
									name="assignMode"
									value="none"
									class="join-item btn flex-1"
									aria-label="Not yet assigned"
									bind:group={assignMode}
								/>
								<input
									type="radio"
									name="assignMode"
									value="user"
									class="join-item btn flex-1"
									aria-label="To a user"
									bind:group={assignMode}
								/>
								<input
									type="radio"
									name="assignMode"
									value="location"
									class="join-item btn flex-1"
									aria-label="To a location"
									bind:group={assignMode}
								/>
							</div>
						</fieldset>

						{#if assignMode === 'none'}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Default location (optional)</legend>
								<select name="defaultLocationId" class="select w-full">
									<option value="">No default location</option>
									{#each data.locations as l (l.id)}
										<option value={l.id}>{l.name}</option>
									{/each}
								</select>
								<p class="text-base-content/50 text-xs">
									Where this {data.objectType.name.toLowerCase()} lives when it isn't checked out to
									anyone — you can still check it out normally later.
								</p>
							</fieldset>
						{:else if assignMode === 'user'}
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<fieldset class="fieldset">
									<legend class="fieldset-legend">
										Assigned to<span class="text-error"> *</span>
									</legend>
									<UserAssignSelect
										name="assignedToUserId"
										required
										options={data.orgUsers.filter((u) => u.role !== 'super_admin')}
									/>
								</fieldset>
								<fieldset class="fieldset">
									<legend class="fieldset-legend">
										Location<span class="text-error"> *</span>
									</legend>
									<LocationSelect name="assignedToLocationId" required orgSlug={data.organization.slug} options={data.locations} />
									<p class="text-base-content/50 text-xs">Where this physically is.</p>
								</fieldset>
							</div>
						{:else}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">
									Location<span class="text-error"> *</span>
								</legend>
								<LocationSelect name="locationOnlyId" required orgSlug={data.organization.slug} options={data.locations} />
							</fieldset>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="space-y-6">
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title text-base">
						<ImagePlus size={16} />
						Image
					</h2>
					<label class="btn btn-outline btn-sm w-full">
						{imageFile ? 'Change image' : 'Choose image'}
						<input
							type="file"
							name="image"
							accept="image/png,image/jpeg,image/webp,image/gif"
							class="hidden"
							onchange={onImageChange}
						/>
					</label>
					{#if imageFile}
						<p class="text-base-content/60 truncate text-xs">{imageFile.name}</p>
					{/if}
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title text-base">
						<Paperclip size={16} />
						Attachments
					</h2>
					<label class="btn btn-outline btn-sm w-full">
						Choose files
						<input
						bind:this={attachmentsInput}
						type="file"
						name="attachments"
						multiple
						class="hidden"
						onchange={onAttachmentsChange}
					/>
					</label>
					{#if attachmentFiles.length > 0}
						<ul class="divide-base-300 mt-1 divide-y">
							{#each attachmentFiles as file, i (file.name + i)}
								<li class="flex items-center justify-between gap-2 py-1.5 text-xs">
									<span class="truncate">{file.name}</span>
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										aria-label={`Remove ${file.name}`}
										onclick={() => removeAttachment(i)}
									>
										<X size={12} />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>

		<div class="lg:col-span-3">
			<button type="submit" class="btn btn-primary">Create record</button>
		</div>
	</form>
</div>
