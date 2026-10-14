<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, KeyRound, Network, PackageCheck, ScrollText, ShieldCheck, UserX } from '@lucide/svelte';
	import { orgRoleBadgeClass, orgRoleIcon } from '$lib/badgeStyles';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const RoleIcon = $derived(orgRoleIcon(data.member.role));
	const isInstanceAdmin = $derived(data.member.user.role === 'super_admin');

	function formatDate(value: string | Date | null | undefined): string {
		if (!value) return '—';
		return new Date(value).toLocaleString();
	}

	function isOverdue(dueAt: string | Date | null): boolean {
		return !!dueAt && new Date(dueAt).getTime() < Date.now();
	}

	const openCheckouts = $derived(data.checkouts.filter((c) => !c.checkedInAt));
	const pastCheckouts = $derived(data.checkouts.filter((c) => c.checkedInAt));
</script>

<div class="space-y-6">
	<a href={`/o/${data.organization.slug}/users`} class="link link-primary flex items-center gap-1 text-sm">
		<ArrowLeft size={14} />
		All users
	</a>

	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="flex items-center gap-2 text-lg font-semibold">
				{data.member.user.name}
				<span class="badge {orgRoleBadgeClass(data.member.role)} gap-1 font-normal capitalize">
					<RoleIcon size={12} />
					{data.member.role}
				</span>
				{#if isInstanceAdmin}
					<span class="badge badge-warning gap-1 font-normal">
						<ShieldCheck size={12} />
						Instance admin
					</span>
				{/if}
			</h1>
			<p class="text-base-content/60 text-sm">{data.member.user.email}</p>
			<div class="mt-1 flex items-center gap-2 text-xs">
				{#if data.member.user.authSource === 'ldap'}
					<span class="badge badge-outline badge-sm gap-1 font-normal">
						<Network size={12} />
						LDAP-managed
					</span>
				{:else}
					<span class="badge badge-outline badge-sm gap-1 font-normal">
						<KeyRound size={12} />
						Email &amp; password
					</span>
				{/if}
				{#if !data.member.user.emailVerified}
					<span class="text-warning">Email not verified</span>
				{/if}
			</div>
		</div>

		<a href={`/o/${data.organization.slug}/logs?actor=${data.member.userId}`} class="btn btn-ghost btn-sm">
			<ScrollText size={14} />
			Full activity log
		</a>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm"><span>{form.message}</span></div>
	{/if}
	{#if form?.resetSent}
		<div class="alert alert-success text-sm"><span>Password reset email sent.</span></div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Account management -->
		<div class="card bg-base-100 border-base-300 border shadow-sm lg:col-span-1">
			<div class="card-body gap-4">
				<h2 class="text-sm font-semibold">Account</h2>

				{#if isInstanceAdmin}
					<div class="alert alert-warning text-sm">
						<ShieldCheck size={16} />
						<span>
							This account is an instance super-admin. Role, password, and membership are managed from the
							Instance Admin console, not here.
						</span>
					</div>
				{:else}
					<form method="post" action="?/updateRole" use:enhance class="space-y-2">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Role in {data.organization.name}</legend>
							<select name="role" class="select select-sm w-full" value={data.member.role}>
								{#each data.orgRoles as r (r)}
									<option value={r}>{r}</option>
								{/each}
							</select>
						</fieldset>
						<button type="submit" class="btn btn-primary btn-sm">Update role</button>
					</form>

					<div class="border-base-300 border-t pt-4">
						{#if data.member.user.authSource === 'local'}
							<form method="post" action="?/sendPasswordReset" use:enhance>
								<button type="submit" class="btn btn-outline btn-sm w-full">
									<KeyRound size={14} />
									Send password reset email
								</button>
							</form>
						{:else}
							<p class="text-base-content/50 text-xs">
								This account authenticates via LDAP — password resets are managed in your directory, not here.
							</p>
						{/if}
					</div>

					<div class="border-base-300 border-t pt-4">
						<form method="post" action="?/remove" use:enhance>
							<button type="submit" class="btn btn-outline btn-error btn-sm w-full">
								<UserX size={14} />
								Remove from organization
							</button>
						</form>
					</div>
				{/if}
			</div>
		</div>

		<!-- Assigned + history -->
		<div class="card bg-base-100 border-base-300 border shadow-sm lg:col-span-2">
			<div class="card-body gap-4">
				<h2 class="flex items-center gap-2 text-sm font-semibold">
					<PackageCheck size={15} />
					Currently assigned
				</h2>
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>Record</th>
								<th>Kind</th>
								<th>Location</th>
								<th>Due back</th>
							</tr>
						</thead>
						<tbody>
							{#each openCheckouts as c (c.id)}
								<tr class="hover">
									<td>
										<a
											href={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.recordId}`}
											class="link link-hover font-medium"
										>
											{c.record.data.values.name ?? c.record.objectType.name}
										</a>
										{#if c.quantity > 1}<span class="text-base-content/50"> × {c.quantity}</span>{/if}
									</td>
									<td class="text-base-content/60 text-xs capitalize">{c.record.objectType.builtinKind}</td>
									<td class="text-sm">{c.assignedToLocation?.name ?? '—'}</td>
									<td class={isOverdue(c.dueAt) ? 'text-error text-sm font-medium' : 'text-sm'}>
										{formatDate(c.dueAt)}
									</td>
								</tr>
							{:else}
								<tr><td colspan="4" class="text-base-content/60">Nothing currently assigned.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>

				<h2 class="mt-2 text-sm font-semibold">Checkout history</h2>
				<div class="max-h-80 overflow-x-auto overflow-y-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>Record</th>
								<th>Checked out</th>
								<th>Checked in</th>
							</tr>
						</thead>
						<tbody>
							{#each pastCheckouts as c (c.id)}
								<tr class="hover">
									<td>
										<a
											href={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.recordId}`}
											class="link link-hover font-medium"
										>
											{c.record.data.values.name ?? c.record.objectType.name}
										</a>
									</td>
									<td class="text-sm">{formatDate(c.checkedOutAt)}</td>
									<td class="text-sm">{formatDate(c.checkedInAt)}</td>
								</tr>
							{:else}
								<tr><td colspan="3" class="text-base-content/60">No past checkouts.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>

				<h2 class="mt-2 text-sm font-semibold">Requests</h2>
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>Record</th>
								<th>Status</th>
								<th>Requested</th>
							</tr>
						</thead>
						<tbody>
							{#each data.requests as r (r.id)}
								<tr class="hover">
									<td>{r.record?.data.values.name ?? r.record?.objectType.name ?? '—'}</td>
									<td><span class="badge badge-ghost badge-sm capitalize">{r.status}</span></td>
									<td class="text-sm">{formatDate(r.createdAt)}</td>
								</tr>
							{:else}
								<tr><td colspan="3" class="text-base-content/60">No requests made.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>

				<h2 class="mt-2 text-sm font-semibold">Recent activity</h2>
				<ul class="space-y-1">
					{#each data.recentActivity as entry (entry.id)}
						<li class="text-base-content/70 text-sm">
							<span class="text-base-content/40 text-xs">{formatDate(entry.createdAt)}</span>
							{entry.summary ?? entry.action}
						</li>
					{:else}
						<li class="text-base-content/60 text-sm">No recorded activity yet.</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</div>
