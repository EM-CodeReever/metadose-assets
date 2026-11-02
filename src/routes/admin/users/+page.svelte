<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Ban,
		ChevronDown,
		CircleX,
		KeyRound,
		Mail,
		Network,
		Search,
		ShieldCheck,
		Trash2,
		Upload,
		User as UserIcon,
		UserPlus
	} from '@lucide/svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	type User = PageServerData['users'][number];

	let dialog: HTMLDialogElement;
	let banDialog: HTMLDialogElement;
	let deleteDialog: HTMLDialogElement;
	let bulkBanDialog: HTMLDialogElement;
	let bulkDeleteDialog: HTMLDialogElement;
	let banTarget = $state<User | null>(null);
	let deleteTarget = $state<User | null>(null);
	let searchQuery = $state('');
	let roleFilter = $state<'all' | 'super_admin' | 'user'>('all');

	let selectedIds = $state<Set<string>>(new Set());
	let bulkSubmitting = $state(false);

	/** Sets the `indeterminate` DOM property — there's no `bind:indeterminate` in Svelte since it
	 *  isn't a real HTML attribute, just a runtime property the checkbox element exposes. */
	function indeterminate(node: HTMLInputElement, value: boolean) {
		node.indeterminate = value;
		return { update: (v: boolean) => (node.indeterminate = v) };
	}

	function toggleOne(id: string, checked: boolean) {
		const next = new Set(selectedIds);
		if (checked) next.add(id);
		else next.delete(id);
		selectedIds = next;
	}

	function toggleSelectAll(checked: boolean) {
		selectedIds = checked ? new Set(filteredUsers.map((u) => u.id)) : new Set();
	}

	let accountType = $state<'user' | 'admin'>('user');
	let credentialMethod = $state<'password' | 'email_link'>('password');
	let creatingUser = $state(false);

	function openCreateDialog() {
		accountType = 'user';
		credentialMethod = 'password';
		creatingUser = false;
		dialog.showModal();
	}

	function openBanDialog(u: User) {
		banTarget = u;
		banDialog.showModal();
	}

	function openDeleteDialog(u: User) {
		deleteTarget = u;
		deleteDialog.showModal();
	}

	const filteredUsers = $derived(
		data.users.filter((u) => {
			const isSuperAdmin = u.role === 'super_admin';
			const matchesRole =
				roleFilter === 'all' || (roleFilter === 'super_admin' ? isSuperAdmin : !isSuperAdmin);
			const q = searchQuery.trim().toLowerCase();
			const matchesSearch =
				!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
			return matchesRole && matchesSearch;
		})
	);

	const allSelected = $derived(filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id)));
	const someSelected = $derived(selectedIds.size > 0 && !allSelected);
	const selectedUsers = $derived(data.users.filter((u) => selectedIds.has(u.id)));
	const selectedIdsJson = $derived(JSON.stringify([...selectedIds]));

	let page = $state(1);
	const paginatedUsers = $derived(filteredUsers.slice((page - 1) * 25, page * 25));
	$effect(() => {
		filteredUsers;
		page = 1;
	});

	function openBulkBanDialog() {
		bulkBanDialog.showModal();
	}
	function openBulkDeleteDialog() {
		bulkDeleteDialog.showModal();
	}

	$effect(() => {
		if (form?.success) {
			dialog?.close();
			banDialog?.close();
			deleteDialog?.close();
			if (form?.bulkAction) {
				bulkBanDialog?.close();
				bulkDeleteDialog?.close();
				selectedIds = new Set();
			}
		}
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold">Users</h1>
			<p class="text-base-content/60 max-w-md text-sm">
				There is no self-service sign-up — accounts are created here. Asset/checkout history lives
				in each organization's own Users page, not here.
			</p>
		</div>
		<div class="flex shrink-0 gap-2">
			{#if data.ldapEnabled}
				<details class="dropdown">
					<summary class="btn btn-outline whitespace-nowrap">
						<Upload size={16} />
						Bulk import
						<ChevronDown size={14} />
					</summary>
					<ul class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-2 shadow">
						<li><a href="/admin/users/import">Import from CSV</a></li>
						<li><a href="/admin/settings/ldap/sync">LDAP sync</a></li>
					</ul>
				</details>
			{:else}
				<a href="/admin/users/import" class="btn btn-outline whitespace-nowrap">
					<Upload size={16} />
					Bulk import
				</a>
			{/if}
			<button class="btn btn-primary whitespace-nowrap" onclick={openCreateDialog}>
				<UserPlus size={16} />
				New user
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<label class="input">
			<Search size={16} class="opacity-50" />
			<input type="text" placeholder="Search by name or email" bind:value={searchQuery} />
		</label>
		<select class="select w-auto" bind:value={roleFilter}>
			<option value="all">All roles</option>
			<option value="super_admin">Super admin</option>
			<option value="user">User</option>
		</select>
		<span class="text-base-content/50 text-sm">
			{filteredUsers.length} of {data.users.length}
		</span>
	</div>

	{#if selectedIds.size > 0}
		<div class="bg-base-200 flex items-center gap-3 rounded-lg px-4 py-2">
			<span class="text-sm font-medium">{selectedIds.size} selected</span>
			<button type="button" class="btn btn-ghost btn-xs text-error" onclick={openBulkBanDialog}>
				<Ban size={13} />
				Ban selected
			</button>
			<button type="button" class="btn btn-ghost btn-xs text-error" onclick={openBulkDeleteDialog}>
				<Trash2 size={13} />
				Delete selected
			</button>
			<button type="button" class="btn btn-ghost btn-xs ml-auto" onclick={() => (selectedIds = new Set())}>
				Clear
			</button>
		</div>
	{/if}

	{#if form?.bulkAction}
		<div class="alert {form.failed > 0 ? 'alert-warning' : 'alert-success'} text-sm">
			<span>
				{form.succeeded} user{form.succeeded === 1 ? '' : 's'} {form.bulkAction === 'ban' ? 'banned' : 'deleted'}.
				{#if form.failed > 0}{form.failed} failed.{/if}
			</span>
		</div>
		{#if form.errors?.length > 0}
			<ul class="divide-base-300 divide-y text-sm">
				{#each form.errors as err (err.userId)}
					<li class="flex items-start gap-2 py-2">
						<CircleX size={14} class="text-error mt-0.5 shrink-0" />
						<span>{err.name ?? err.userId}: {err.message}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#if form?.message}
		<div class="alert alert-error text-sm"><span>{form.message}</span></div>
	{/if}
	{#if form?.resetSentFor}
		<div class="alert alert-success text-sm"><span>Password reset email sent.</span></div>
	{/if}
	{#if form?.emailedLinkTo}
		<div class="alert alert-success text-sm">
			<span>An email was sent to {form.emailedLinkTo} with a link to set their password.</span>
		</div>
	{/if}
	{#if form?.deleteMode === 'deleted'}
		<div class="alert alert-success text-sm"><span>User deleted.</span></div>
	{:else if form?.deleteMode === 'anonymized'}
		<div class="alert alert-success text-sm">
			<span>
				This account had existing history (checkouts, created records, activity), so it was
				anonymized instead of deleted — their name/email are scrubbed, login is revoked, and
				they've been removed from every organization, but the historical records they're
				attached to are left intact.
			</span>
		</div>
	{/if}

	<div class="card bg-base-100 shadow">
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
								onchange={(e) => toggleSelectAll(e.currentTarget.checked)}
							/>
						</th>
						<th>User</th>
						<th>Organizations</th>
						<th>Auth</th>
						<th>Status</th>
						<th class="text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedUsers as u (u.id)}
						<tr class="hover">
							<td>
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={selectedIds.has(u.id)}
									onchange={(e) => toggleOne(u.id, e.currentTarget.checked)}
								/>
							</td>
							<td>
								<p class="font-medium">{u.name}</p>
								<p class="text-base-content/60 text-sm">{u.email}</p>
								{#if u.role === 'super_admin'}
									<span class="badge badge-primary badge-sm mt-1 gap-1">
										<ShieldCheck size={11} />
										Super admin
									</span>
								{/if}
							</td>
							<td class="text-sm">
								{#if u.members.length === 0}
									<span class="text-base-content/40">—</span>
								{:else}
									<div class="flex flex-wrap gap-1">
										{#each u.members as m (m.id)}
											<span class="badge badge-ghost badge-sm font-normal">
												{m.organization.name} · {m.role}
											</span>
										{/each}
									</div>
								{/if}
							</td>
							<td>
								{#if u.authSource === 'ldap'}
									<span class="badge badge-outline badge-sm gap-1 font-normal">
										<Network size={12} />
										LDAP
									</span>
								{:else}
									<span class="badge badge-outline badge-sm gap-1 font-normal">
										<KeyRound size={12} />
										Local
									</span>
								{/if}
							</td>
							<td>
								{#if u.banned}
									<span class="badge badge-error badge-sm">Banned</span>
								{:else}
									<span class="text-base-content/40 text-xs">Active</span>
								{/if}
							</td>
							<td class="text-right">
								<div class="flex justify-end gap-1">
									{#if u.authSource === 'local'}
										<form method="post" action="?/resetPassword" use:enhance>
											<input type="hidden" name="userId" value={u.id} />
											<button type="submit" class="btn btn-ghost btn-xs" title="Send password reset email">
												<KeyRound size={13} />
												Reset
											</button>
										</form>
									{/if}
									{#if u.banned}
										<form method="post" action="?/unban" use:enhance>
											<input type="hidden" name="userId" value={u.id} />
											<button type="submit" class="btn btn-ghost btn-xs">Unban</button>
										</form>
									{:else}
										<button
											type="button"
											class="btn btn-ghost btn-xs text-error"
											onclick={() => openBanDialog(u)}
										>
											<Ban size={13} />
											Ban
										</button>
									{/if}
									<button
										type="button"
										class="btn btn-ghost btn-xs text-error"
										onclick={() => openDeleteDialog(u)}
									>
										<Trash2 size={13} />
										Delete
									</button>
								</div>
							</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="text-base-content/60">No users match your filters.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="card-body py-3">
			<Pagination bind:page totalItems={filteredUsers.length} />
		</div>
	</div>
</div>

<dialog bind:this={dialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Create user</h3>

		<div class="join mt-4 w-full">
			<label class="join-item btn btn-sm flex-1 gap-1.5" class:btn-info={accountType === 'user'}>
				<input type="radio" name="account-type-tab" value="user" class="hidden" bind:group={accountType} />
				<UserIcon size={14} />
				User
			</label>
			<label class="join-item btn btn-sm flex-1 gap-1.5" class:btn-secondary={accountType === 'admin'}>
				<input type="radio" name="account-type-tab" value="admin" class="hidden" bind:group={accountType} />
				<ShieldCheck size={14} />
				Instance admin
			</label>
		</div>

		<form
			method="post"
			action="?/create"
			use:enhance={() => {
				creatingUser = true;
				return async ({ update }) => {
					await update();
					creatingUser = false;
				};
			}}
			class="mt-4 space-y-4"
		>
			<input type="hidden" name="accountType" value={accountType} />
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Name</legend>
				<input name="name" required class="input w-full" />
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Email</legend>
				<input type="email" name="email" required class="input w-full" />
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Credential</legend>
				<div class="join w-full">
					<label class="join-item btn btn-sm flex-1 gap-1.5" class:btn-primary={credentialMethod === 'password'}>
						<input
							type="radio"
							name="credential-method-tab"
							value="password"
							class="hidden"
							bind:group={credentialMethod}
						/>
						<KeyRound size={14} />
						Set a password
					</label>
					<label
						class="join-item btn btn-sm flex-1 gap-1.5"
						class:btn-primary={credentialMethod === 'email_link'}
					>
						<input
							type="radio"
							name="credential-method-tab"
							value="email_link"
							class="hidden"
							bind:group={credentialMethod}
						/>
						<Mail size={14} />
						Email a link
					</label>
				</div>
				<input type="hidden" name="credentialMethod" value={credentialMethod} />
			</fieldset>

			{#if credentialMethod === 'password'}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Password</legend>
					<input type="password" name="password" required minlength="8" class="input w-full" />
				</fieldset>
				<label class="label gap-2">
					<input type="checkbox" name="requirePasswordChange" class="checkbox checkbox-sm" />
					Require a password change on first sign-in
				</label>
			{:else}
				<p class="text-base-content/60 text-xs">
					They'll be emailed a link to set their own password instead of you choosing one for them.
				</p>
			{/if}

			{#if form?.message}
				<div class="alert alert-error text-sm">
					<span>{form.message}</span>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" disabled={creatingUser} onclick={() => dialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={creatingUser}>
					{#if creatingUser}
						<span class="loading loading-spinner loading-sm"></span>
						Creating...
					{:else}
						Create user
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<dialog bind:this={banDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Ban {banTarget?.name}</h3>
		<p class="text-base-content/60 text-sm">
			They'll be signed out and unable to sign back in until unbanned.
		</p>

		<form method="post" action="?/ban" use:enhance class="mt-4 space-y-4">
			<input type="hidden" name="userId" value={banTarget?.id} />
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Reason (optional)</legend>
				<input name="banReason" class="input w-full" placeholder="e.g. Offboarded employee" />
			</fieldset>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => banDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-error">Ban user</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<dialog bind:this={deleteDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Delete {deleteTarget?.name}?</h3>
		<p class="text-base-content/60 mt-2 text-sm">
			If this account has never checked anything out, created a record, or left any other
			trace, it's deleted outright. If it has history anywhere, it's anonymized instead — name
			and email scrubbed, login revoked, removed from every organization — so the records it's
			attached to (checkouts, activity logs, created items) don't lose their attribution
			entirely. Either way, this can't be undone.
		</p>

		<form method="post" action="?/deleteUser" use:enhance class="mt-4">
			<input type="hidden" name="userId" value={deleteTarget?.id} />
			{#if form?.message}
				<div class="alert alert-error mb-4 text-sm">
					<span>{form.message}</span>
				</div>
			{/if}
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => deleteDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-error">
					<Trash2 size={14} />
					Delete
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<dialog bind:this={bulkBanDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Ban {selectedUsers.length} user{selectedUsers.length === 1 ? '' : 's'}?</h3>
		<p class="text-base-content/60 mt-2 text-sm">They'll be signed out and unable to sign back in until unbanned.</p>
		<ul class="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
			{#each selectedUsers as u (u.id)}
				<li class="text-base-content/70">{u.name} <span class="text-base-content/40">({u.email})</span></li>
			{/each}
		</ul>

		<form
			method="post"
			action="?/bulkBan"
			use:enhance={() => {
				bulkSubmitting = true;
				return async ({ update }) => {
					await update();
					bulkSubmitting = false;
				};
			}}
			class="mt-4"
		>
			<input type="hidden" name="userIds" value={selectedIdsJson} />
			<div class="modal-action">
				<button type="button" class="btn" disabled={bulkSubmitting} onclick={() => bulkBanDialog.close()}>Cancel</button>
				<button type="submit" class="btn btn-error" disabled={bulkSubmitting}>
					{#if bulkSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
						Banning...
					{:else}
						<Ban size={14} />
						Ban {selectedUsers.length}
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<dialog bind:this={bulkDeleteDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Delete {selectedUsers.length} user{selectedUsers.length === 1 ? '' : 's'}?</h3>
		<p class="text-base-content/60 mt-2 text-sm">
			Each account is deleted outright if it has no history anywhere, or anonymized (name/email
			scrubbed, access revoked, removed from every organization) if it does — same rule as a
			single delete, applied per account. This can't be undone.
		</p>
		<ul class="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
			{#each selectedUsers as u (u.id)}
				<li class="text-base-content/70">{u.name} <span class="text-base-content/40">({u.email})</span></li>
			{/each}
		</ul>

		<form
			method="post"
			action="?/bulkDelete"
			use:enhance={() => {
				bulkSubmitting = true;
				return async ({ update }) => {
					await update();
					bulkSubmitting = false;
				};
			}}
			class="mt-4"
		>
			<input type="hidden" name="userIds" value={selectedIdsJson} />
			<div class="modal-action">
				<button type="button" class="btn" disabled={bulkSubmitting} onclick={() => bulkDeleteDialog.close()}>
					Cancel
				</button>
				<button type="submit" class="btn btn-error" disabled={bulkSubmitting}>
					{#if bulkSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
						Deleting...
					{:else}
						<Trash2 size={14} />
						Delete {selectedUsers.length}
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
