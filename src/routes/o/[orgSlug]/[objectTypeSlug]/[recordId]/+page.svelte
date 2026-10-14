<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Archive,
		ArchiveRestore,
		Bell,
		Boxes,
		ChevronDown,
		ClipboardCheck,
		Clock,
		Cpu,
		Download,
		ImagePlus,
		Keyboard,
		Package,
		Pencil,
		Puzzle,
		QrCode,
		Send,
		PackageCheck,
		PackagePlus,
		Paperclip,
		TriangleAlert,
		Trash,
		Upload,
		X
	} from '@lucide/svelte';
	import { recordStatusBadgeClass } from '$lib/badgeStyles';
	import { formatDateTime } from '$lib/dateFormat';
	import UserAssignSelect from '$lib/components/UserAssignSelect.svelte';
	import LocationSelect from '$lib/components/LocationSelect.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let deleteDialog: HTMLDialogElement;
	let checkoutDialog: HTMLDialogElement;
	let stockDialog: HTMLDialogElement;
	let checkoutError = $state('');
	let stockError = $state('');
	let imageError = $state('');
	let assetAssignedToType = $state<'user' | 'location'>('user');

	const kind = $derived(data.objectType.builtinKind);
	const isQuantityBased = $derived(data.rules.quantityBased);
	const allowCheckin = $derived(data.rules.allowCheckin);
	const isMember = $derived(data.membership?.role === 'member');
	const effectiveRequestable = $derived(data.record.requestableOverride ?? data.objectType.requestable);
	const isRequestable = $derived(
		effectiveRequestable &&
			data.record.status !== 'archived' &&
			(isQuantityBased ? (data.availableQuantity ?? 0) > 0 : data.openCheckouts.length === 0) &&
			kind !== 'component'
	);

	const KIND_ICONS = { asset: Boxes, accessory: Keyboard, consumable: Package, component: Cpu, custom: Puzzle };
	const KindIcon = $derived(KIND_ICONS[kind] ?? Puzzle);

	// Only quantity-based, returnable kinds can check in part of a checkout's quantity while
	// leaving the rest held by the same person (e.g. 1 of 3 mice). A condition field on top of
	// that also lets some of what's returning be routed to a different condition.
	const conditionField = $derived(data.objectType.fields.find((f) => f.dataType === 'reference' && f.referenceKind === 'condition'));
	const canCheckinDetailed = $derived(isQuantityBased && allowCheckin && !isMember);

	const currentCondition = $derived(
		conditionField
			? data.lookupValues.condition?.find((c) => c.id === data.record.data.values[conditionField.key])
			: undefined
	);
	const isOutOfServiceCondition = $derived(currentCondition?.outOfService ?? false);

	let splitDialog: HTMLDialogElement;
	let splitTarget = $state<(typeof data.openCheckouts)[number] | null>(null);
	let splitError = $state('');
	let checkinQuantityInput = $state(1);
	let splitQuantityInput = $state(0);

	function openSplitDialog(c: (typeof data.openCheckouts)[number]) {
		splitTarget = c;
		splitError = '';
		checkinQuantityInput = c.quantity;
		splitQuantityInput = 0;
		splitDialog.showModal();
	}

	const defaultLocationName = $derived(
		data.record.defaultLocationId
			? (data.locations.find((l) => l.id === data.record.defaultLocationId)?.name ?? null)
			: null
	);

	const orgUserNames = $derived(new Map(data.orgUsers.map((u) => [u.id, u.name])));
	const assetNames = $derived(new Map(data.assetOptions.map((a) => [a.id, String(a.data.values.name ?? a.id)])));
	const lookupNames = $derived(new Map(Object.values(data.lookupValues).flat().map((v) => [v.id, v.name])));
	const isArchived = $derived(data.record.status === 'archived');
	const canArchive = $derived(!isQuantityBased);

	const totalQuantity = $derived(Number(data.record.data.values[data.rules.quantityFieldKey]) || 0);
	const minQuantity = $derived(Number(data.record.data.values.minQuantity) || 0);
	const outOfStock = $derived(kind === 'consumable' && (data.availableQuantity ?? 0) <= 0);
	const lowStock = $derived(
		kind === 'consumable' && !outOfStock && data.availableQuantity !== null && data.availableQuantity <= minQuantity
	);

	function displayValue(field: (typeof data.objectType.fields)[number], value: unknown): string {
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

	function formatDate(value: string | Date | null | undefined): string {
		return formatDateTime(value, data.timezone);
	}

	function isOverdue(dueAt: string | Date | null | undefined): boolean {
		return !!dueAt && new Date(dueAt).getTime() < Date.now();
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function holderName(c: (typeof data.openCheckouts)[number]): string {
		if (c.assignedToUser && c.assignedToLocation) return `${c.assignedToUser.name} — ${c.assignedToLocation.name}`;
		if (c.assignedToUser) return c.assignedToUser.name;
		if (c.assignedToLocation) return c.assignedToLocation.name;
		if (c.assignedToRecord) return assetNames.get(c.assignedToRecord.id) ?? String(c.assignedToRecord.data.values.name ?? '');
		return '—';
	}

	const ACTIVITY_LABELS: Record<string, string> = {
		'record.created': 'Created',
		'record.updated': 'Updated',
		'record.deleted': 'Deleted',
		'record.checked_out': 'Checked out',
		'record.checked_in': 'Checked in',
		'record.stock_added': 'Stock added',
		'record.accepted': 'Receipt confirmed',
		'record.reminder_sent': 'Reminder sent',
		'record.condition_split_out': 'Checked in with condition change',
		'record.condition_split_in': 'Received from condition change',
		'record.requested': 'Requested',
		'record.request_approved': 'Request approved',
		'record.request_rejected': 'Request rejected',
		'record.request_cancelled': 'Request cancelled',
		'attachment.added': 'Attachment added',
		'attachment.removed': 'Attachment removed'
	};
</script>

<div class="mx-auto max-w-6xl space-y-6 2xl:max-w-[1600px]">
	<div class="flex items-start justify-between gap-4">
		<div>
			<a
				href={`/o/${data.organization.slug}/${data.objectType.slug}`}
				class="link link-primary text-sm"
			>
				&larr; {data.objectType.name}
			</a>
			<div class="mt-1 flex items-center gap-2">
				<h1 class="text-lg font-semibold">
					{data.record.data.values.name ?? 'Record'}
				</h1>
				{#if !isQuantityBased}
					<span class="badge badge-sm whitespace-nowrap capitalize {recordStatusBadgeClass(data.record.status)}">
						{data.record.status.replace('_', ' ')}
					</span>
				{/if}
				{#if outOfStock}
					<span class="badge badge-error badge-sm gap-1">
						<TriangleAlert size={12} />
						Out of stock
					</span>
				{:else if lowStock}
					<span class="badge badge-warning badge-sm gap-1">
						<TriangleAlert size={12} />
						Low stock
					</span>
				{/if}
			</div>
		</div>
		{#if !isMember}
			<div class="flex items-center gap-2">
				{#if kind !== 'component'}
					<form method="post" action="?/setRequestable" use:enhance>
						<select
							name="requestableOverride"
							class="select select-sm"
							title="Whether members can request this specific record"
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
						>
							<option value="" selected={data.record.requestableOverride === null}>
								Requestable: Default ({data.objectType.requestable ? 'yes' : 'no'})
							</option>
							<option value="true" selected={data.record.requestableOverride === true}>
								Requestable: Always
							</option>
							<option value="false" selected={data.record.requestableOverride === false}>
								Requestable: Never
							</option>
						</select>
					</form>
				{/if}
				<a
					href={`/o/${data.organization.slug}/${data.objectType.slug}/${data.record.id}/label`}
					class="btn btn-ghost btn-sm"
				>
					<QrCode size={14} />
					Print label
				</a>
				<a
					href={`/o/${data.organization.slug}/${data.objectType.slug}/${data.record.id}/edit`}
					class="btn btn-ghost btn-sm"
				>
					<Pencil size={14} />
					Edit
				</a>
				{#if canArchive}
					{#if isArchived}
						<form method="post" action="?/unarchive" use:enhance>
							<button type="submit" class="btn btn-ghost btn-sm">
								<ArchiveRestore size={14} />
								Unarchive
							</button>
						</form>
					{:else}
						<form method="post" action="?/archive" use:enhance>
							<button type="submit" class="btn btn-ghost btn-sm">
								<Archive size={14} />
								Archive
							</button>
						</form>
					{/if}
				{/if}
				<button type="button" class="btn btn-ghost btn-sm text-error" onclick={() => deleteDialog.showModal()}>
					<Trash size={14} />
					Delete
				</button>
			</div>
		{/if}
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="space-y-6 lg:col-span-2">
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<div class="flex items-center justify-between">
						<h2 class="card-title text-base">
							{kind === 'consumable' ? 'Stock' : isQuantityBased ? 'Availability' : 'Checkout'}
						</h2>
						<div class="flex gap-2">
							{#if isMember}
								{#if data.hasPendingRequest}
									<span class="badge badge-ghost">Request pending</span>
								{:else if isRequestable}
									<form method="post" action="?/request" use:enhance>
										<button type="submit" class="btn btn-primary btn-sm">Request this item</button>
									</form>
								{:else}
									<span class="text-base-content/50 text-sm">
										{effectiveRequestable ? 'Not available to request' : 'Requesting is turned off for this record'}
									</span>
								{/if}
							{:else if kind === 'consumable'}
								<button type="button" class="btn btn-ghost btn-sm" onclick={() => stockDialog.showModal()}>
									<PackagePlus size={14} />
									Add stock
								</button>
								<button type="button" class="btn btn-primary btn-sm" onclick={() => checkoutDialog.showModal()}>
									<Send size={14} />
									Issue
								</button>
							{:else if isQuantityBased}
								<button
									type="button"
									class="btn btn-primary btn-sm"
									disabled={(data.availableQuantity ?? 0) <= 0}
									onclick={() => checkoutDialog.showModal()}
								>
									<Send size={14} />
									Check out
								</button>
							{:else if data.openCheckouts.length === 0}
								<button
									type="button"
									class="btn btn-primary btn-sm"
									disabled={isArchived}
									onclick={() => checkoutDialog.showModal()}
								>
									<Send size={14} />
									Check out
								</button>
							{/if}
						</div>
					</div>

					{#if isQuantityBased}
						<p class="text-base-content/60 text-sm">
							{kind === 'consumable' ? 'Remaining' : 'Available'}
							<span class="text-base-content font-semibold">{data.availableQuantity}</span>
							of {totalQuantity}
							{#if kind === 'consumable' && minQuantity > 0}
								<span class="text-base-content/50">(min {minQuantity})</span>
							{/if}
						</p>
					{/if}

					{#if data.openCheckouts.length > 0}
						<ul class="divide-base-300 mt-2 divide-y">
							{#each data.openCheckouts as c (c.id)}
								<li class="flex items-center justify-between gap-4 py-2 text-sm">
									<div class="flex items-center gap-3">
										{#if c.assignedToUserId}
											{@const overdue = isOverdue(c.dueAt)}
											<div
												class="tooltip tooltip-right"
												data-tip="{c.acceptedAt ? 'User receipt confirmed' : 'Awaiting receipt confirmation'}{overdue
													? ' — check-in overdue'
													: ''}"
											>
												<div
													class="flex h-8 w-8 shrink-0 items-center justify-center rounded-box {c.acceptedAt
														? 'bg-success/15 text-success'
														: 'bg-warning/15 text-warning'} {overdue ? 'ring-error ring-1 ring-inset' : ''}"
												>
													{#if c.acceptedAt}
														<ClipboardCheck size={16} />
													{:else}
														<Clock size={16} />
													{/if}
												</div>
											</div>
										{/if}
										<div>
											<p class="font-medium">
												{holderName(c)}
												{#if isQuantityBased}<span class="text-base-content/50"> × {c.quantity}</span>{/if}
											</p>
											<p class="text-base-content/50 text-xs">
												{formatDate(c.checkedOutAt)}
												{#if c.dueAt}
													<span class={isOverdue(c.dueAt) ? 'text-error font-medium' : ''}>
														· due {formatDate(c.dueAt)}
													</span>
												{/if}
												{#if c.notes}· {c.notes}{/if}
											</p>
										</div>
									</div>
									<div class="flex items-center gap-2">
										{#if c.assignedToUserId === data.user.id && !c.acceptedAt}
											<form method="post" action="?/accept" use:enhance>
												<input type="hidden" name="checkoutId" value={c.id} />
												<button type="submit" class="btn btn-success btn-sm">
													<PackageCheck size={14} />
													Confirm receipt
												</button>
											</form>
										{/if}
										{#if !isMember && c.assignedToUserId && !c.acceptedAt}
											<form method="post" action="?/sendReminder" use:enhance>
												<input type="hidden" name="checkoutId" value={c.id} />
												<button type="submit" class="btn btn-ghost btn-sm">
													<Bell size={14} />
													Send reminder
												</button>
											</form>
										{/if}
										{#if allowCheckin && !isMember}
											{#if canCheckinDetailed}
												<div class="join">
													<form method="post" action="?/checkin" use:enhance>
														<input type="hidden" name="checkoutId" value={c.id} />
														<button type="submit" class="btn btn-ghost btn-sm join-item">
															<PackageCheck size={14} />
															Check in
														</button>
													</form>
													<details class="dropdown dropdown-end">
														<summary
															class="btn btn-ghost btn-sm join-item px-2"
															aria-label="More check-in options"
														>
															<ChevronDown size={14} />
														</summary>
														<ul class="dropdown-content menu bg-base-100 rounded-box z-10 w-64 p-2 shadow">
															<li>
																<button
																	type="button"
																	onclick={(e) => {
																		e.currentTarget.closest('details')?.removeAttribute('open');
																		openSplitDialog(c);
																	}}
																>
																	<TriangleAlert size={14} />
																	Check in some / condition change
																</button>
															</li>
														</ul>
													</details>
												</div>
											{:else}
												<form method="post" action="?/checkin" use:enhance>
													<input type="hidden" name="checkoutId" value={c.id} />
													<button type="submit" class="btn btn-ghost btn-sm">
														<PackageCheck size={14} />
														Check in
													</button>
												</form>
											{/if}
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{:else if !isQuantityBased}
						<p class="text-base-content/60 mt-2 text-sm">
							This record is currently available.
							{#if defaultLocationName}
								<span class="text-base-content/50">Default location: {defaultLocationName}.</span>
							{/if}
						</p>
					{/if}
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title text-base">Fields</h2>
					<dl class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
						{#each data.objectType.fields as field (field.id)}
							<div class="border-base-300 flex justify-between gap-4 border-b py-2 text-sm">
								<dt class="text-base-content/60">{field.label}</dt>
								<dd class="text-right font-medium">
									{displayValue(field, data.record.data.values[field.key])}
								</dd>
							</div>
						{/each}
					</dl>
				</div>
			</div>

			{#if data.canHoldComponents}
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<h2 class="card-title text-base">
							<Cpu size={16} />
							Installed components
						</h2>
						<ul class="divide-base-300 divide-y">
							{#each data.installedComponents as c (c.id)}
								<li class="flex items-center justify-between gap-4 py-2 text-sm">
									<a
										href={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.record.id}`}
										class="link link-hover font-medium"
									>
										{c.record.data.values.name ?? c.record.objectType.name}
									</a>
									<span class="text-base-content/50">
										× {c.quantity}
										{#if c.quantity > 1}units{:else}unit{/if}
									</span>
								</li>
							{:else}
								<li class="text-base-content/60 py-2 text-sm">No components installed.</li>
							{/each}
						</ul>
					</div>
				</div>
			{/if}
		</div>

		<div class="space-y-6">
			<div class="group relative aspect-square w-full overflow-hidden rounded-box bg-base-200">
				{#if data.record.imageFileName}
					<img
						src={`/o/${data.organization.slug}/${data.objectType.slug}/${data.record.id}/image?v=${new Date(data.record.updatedAt).getTime()}`}
						alt=""
						class="h-full w-full object-cover"
					/>
				{:else}
					<div class="text-base-content/30 flex h-full w-full items-center justify-center">
						<KindIcon class="h-[30%] w-[30%]" />
					</div>
				{/if}

				{#if !isMember}
					<div
						class="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
					>
						<form
							method="post"
							action="?/uploadImage"
							enctype="multipart/form-data"
							use:enhance={() => {
								imageError = '';
								return async ({ result, update }) => {
									if (result.type === 'failure') {
										imageError = (result.data?.message as string) ?? 'Could not upload image';
									} else {
										await update();
									}
								};
							}}
						>
							<label
								class="btn btn-circle btn-sm"
								aria-label={data.record.imageFileName ? 'Change image' : 'Add image'}
							>
								<ImagePlus size={16} />
								<input
									type="file"
									name="image"
									accept="image/png,image/jpeg,image/webp,image/gif"
									class="hidden"
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								/>
							</label>
						</form>
						{#if data.record.imageFileName}
							<form method="post" action="?/removeImage" use:enhance>
								<button type="submit" class="btn btn-circle btn-sm btn-error" aria-label="Remove image">
									<X size={16} />
								</button>
							</form>
						{/if}
					</div>
				{/if}
			</div>
			{#if imageError}
				<p class="text-error -mt-4 text-xs">{imageError}</p>
			{/if}

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<div class="flex items-center justify-between">
						<h2 class="card-title text-base">
							<Paperclip size={16} />
							Attachments
						</h2>
						{#if !isMember}
							<form method="post" action="?/uploadAttachment" enctype="multipart/form-data" use:enhance>
								<label class="btn btn-ghost btn-sm">
									<Upload size={14} />
									Upload
									<input
										type="file"
										name="file"
										class="hidden"
										onchange={(e) => e.currentTarget.form?.requestSubmit()}
									/>
								</label>
							</form>
						{/if}
					</div>
					<ul class="divide-base-300 mt-2 divide-y">
						{#each data.attachments as file (file.id)}
							<li class="flex items-center justify-between gap-4 py-2 text-sm">
								<div>
									<p class="font-medium">{file.fileName}</p>
									<p class="text-base-content/50 text-xs">
										{formatSize(file.sizeBytes)} · {file.uploadedByUser?.name} · {formatDate(file.createdAt)}
									</p>
								</div>
								<div class="flex items-center gap-1">
									<a
										href={`/o/${data.organization.slug}/${data.objectType.slug}/${data.record.id}/attachments/${file.id}`}
										data-sveltekit-reload
										class="btn btn-ghost btn-xs"
										aria-label="Download"
									>
										<Download size={14} />
									</a>
									{#if !isMember}
										<form method="post" action="?/deleteAttachment" use:enhance>
											<input type="hidden" name="attachmentId" value={file.id} />
											<button type="submit" class="btn btn-ghost btn-xs text-error" aria-label="Delete">
												<Trash size={14} />
											</button>
										</form>
									{/if}
								</div>
							</li>
						{:else}
							<li class="text-base-content/60 py-2 text-sm">No attachments yet.</li>
						{/each}
					</ul>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title text-base">Activity</h2>
					<ul class="mt-2 space-y-3">
						{#each data.activity as entry (entry.id)}
							<li class="flex justify-between gap-4 text-sm">
								<span>
									<span class="font-medium">{ACTIVITY_LABELS[entry.action] ?? entry.action}</span>
									{#if entry.actor}
										<span class="text-base-content/60"> by {entry.actor.name}</span>
									{/if}
								</span>
								<span class="text-base-content/50">{formatDate(entry.createdAt)}</span>
							</li>
						{:else}
							<li class="text-base-content/60 text-sm">No activity yet.</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>

<dialog bind:this={deleteDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Delete this record?</h3>
		<p class="text-base-content/60 mt-2 text-sm">This can't be undone.</p>
		<form method="post" action="?/delete" use:enhance class="modal-action">
			<button type="button" class="btn" onclick={() => deleteDialog.close()}>Cancel</button>
			<button type="submit" class="btn btn-error">Delete</button>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<dialog bind:this={checkoutDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">
			{kind === 'consumable' ? 'Issue' : kind === 'component' ? 'Install into an asset' : 'Check out'}
		</h3>
		{#if isOutOfServiceCondition}
			<div class="alert alert-warning mt-2 text-sm">
				<TriangleAlert size={14} />
				<span>This record's condition ({currentCondition?.name}) is flagged out of service.</span>
			</div>
		{/if}
		<form
			method="post"
			action="?/checkout"
			use:enhance={() => {
				checkoutError = '';
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						checkoutError = (result.data?.message as string) ?? 'Could not complete this action';
					} else {
						await update();
						checkoutDialog.close();
					}
				};
			}}
			class="mt-4 space-y-4"
		>
			{#if data.rules.targetType === 'user_or_location'}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Assign to</legend>
					<div class="join w-full">
						<input
							type="radio"
							name="assignedToType"
							value="user"
							class="join-item btn flex-1"
							aria-label="User"
							bind:group={assetAssignedToType}
						/>
						<input
							type="radio"
							name="assignedToType"
							value="location"
							class="join-item btn flex-1"
							aria-label="Location"
							bind:group={assetAssignedToType}
						/>
					</div>
				</fieldset>
				{#if assetAssignedToType === 'user'}
					<fieldset class="fieldset">
						<legend class="fieldset-legend">User</legend>
						<UserAssignSelect
							name="assignedToUserId"
							required
							options={data.orgUsers.filter((u) => u.role !== 'super_admin')}
						/>
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Location</legend>
						<LocationSelect name="assignedToLocationId" required orgSlug={data.organization.slug} options={data.locations} />
						<p class="text-base-content/50 text-xs">Tracks where this asset physically is.</p>
					</fieldset>
				{:else}
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Location</legend>
						<LocationSelect name="assignedToLocationId" required orgSlug={data.organization.slug} options={data.locations} />
					</fieldset>
				{/if}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Due back (optional)</legend>
					<input type="date" name="dueAt" class="input w-full" />
				</fieldset>
			{:else if data.rules.targetType === 'asset'}
				<input type="hidden" name="assignedToType" value="asset" />
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Quantity</legend>
					<input
						type="number"
						name="quantity"
						min="1"
						max={data.availableQuantity ?? undefined}
						value="1"
						class="input w-full"
					/>
					<p class="text-base-content/50 text-xs">{data.availableQuantity} available</p>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Install into</legend>
					{#if data.assetOptions.length === 0}
						<p class="text-base-content/60 text-sm">No assets exist yet to install this into.</p>
					{:else}
						<select name="assignedToRecordId" required class="select w-full">
							<option value="" disabled selected>Select an asset</option>
							{#each data.assetOptions as a (a.id)}
								<option value={a.id}>{a.data.values.name ?? a.id} ({a.objectType.name})</option>
							{/each}
						</select>
					{/if}
				</fieldset>
			{:else}
				<input type="hidden" name="assignedToType" value="user" />
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Quantity</legend>
					<input
						type="number"
						name="quantity"
						min="1"
						max={data.availableQuantity ?? undefined}
						value="1"
						class="input w-full"
					/>
					<p class="text-base-content/50 text-xs">{data.availableQuantity} available</p>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">User</legend>
					<UserAssignSelect
						name="assignedToUserId"
						required
						options={data.orgUsers.filter((u) => u.role !== 'super_admin')}
					/>
				</fieldset>
				{#if allowCheckin}
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Due back (optional)</legend>
						<input type="date" name="dueAt" class="input w-full" />
					</fieldset>
				{/if}
			{/if}
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Notes (optional)</legend>
				<textarea name="notes" class="textarea w-full" rows="2"></textarea>
			</fieldset>
			{#if checkoutError}
				<div class="alert alert-error text-sm">
					<span>{checkoutError}</span>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => checkoutDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary">
					{kind === 'consumable' ? 'Issue' : kind === 'component' ? 'Install' : 'Check out'}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<dialog bind:this={stockDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Add stock</h3>
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
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Amount to add</legend>
				<input type="number" name="amount" min="1" value="1" required class="input w-full" />
				<p class="text-base-content/50 text-xs">Current total: {totalQuantity}</p>
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

<dialog bind:this={splitDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Check in</h3>
		<p class="text-base-content/60 mt-1 text-sm">
			Check in part of this checkout, report a condition change on some of what's returning,
			or both — whatever's left stays checked out to the same person.
		</p>
		<form
			method="post"
			action="?/checkinDetailed"
			use:enhance={() => {
				splitError = '';
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						splitError = (result.data?.message as string) ?? 'Could not check in';
					} else {
						await update();
						splitDialog.close();
					}
				};
			}}
			class="mt-4 space-y-4"
		>
			<input type="hidden" name="checkoutId" value={splitTarget?.id ?? ''} />
			<fieldset class="fieldset">
				<legend class="fieldset-legend">How many are you checking in now?</legend>
				<input
					type="number"
					name="checkinQuantity"
					min="1"
					max={splitTarget?.quantity ?? 1}
					bind:value={checkinQuantityInput}
					required
					class="input w-full"
				/>
				<p class="text-base-content/50 text-xs">
					Out of {splitTarget?.quantity ?? 1} currently checked out to {splitTarget
						? holderName(splitTarget)
						: ''}.
					{#if (splitTarget?.quantity ?? 1) > checkinQuantityInput}
						The remaining {(splitTarget?.quantity ?? 1) - checkinQuantityInput} stay checked out to them.
					{/if}
				</p>
			</fieldset>
			{#if conditionField}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Of those, how many are in a different condition?</legend>
					<input
						type="number"
						name="splitQuantity"
						min="0"
						max={checkinQuantityInput}
						bind:value={splitQuantityInput}
						class="input w-full"
					/>
					<p class="text-base-content/50 text-xs">Leave at 0 if nothing's changed.</p>
				</fieldset>
				{#if splitQuantityInput > 0}
					<fieldset class="fieldset">
						<legend class="fieldset-legend">New condition</legend>
						<select name="targetConditionId" required class="select w-full">
							<option value="" disabled selected>Select a condition</option>
							{#each data.lookupValues.condition as cond (cond.id)}
								<option value={cond.id}>{cond.name}{cond.outOfService ? ' (out of service)' : ''}</option>
							{/each}
						</select>
					</fieldset>
				{/if}
			{/if}
			{#if splitError}
				<div class="alert alert-error text-sm">
					<span>{splitError}</span>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => splitDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary">Check in</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
