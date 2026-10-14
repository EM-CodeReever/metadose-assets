<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, RefreshCw } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const roleOptions = ['owner', 'admin', 'manager', 'viewer', 'member'];
	const memberUserIds = $derived(new Set(data.organization.members.map((m) => m.userId)));
	const availableUsers = $derived(data.allUsers.filter((u) => !memberUserIds.has(u.id)));
</script>

<div class="space-y-8">
	<div class="flex items-start justify-between">
		<div>
			<a href="/admin/organizations" class="link link-primary text-sm">&larr; Organizations</a>
			<h1 class="text-lg font-semibold">{data.organization.name}</h1>
			<p class="text-base-content/60 text-sm">/{data.organization.slug}</p>
		</div>
		<div class="flex gap-2">
			<form method="post" action="?/provisionBuiltins" use:enhance>
				<button type="submit" class="btn btn-outline btn-sm" title="Create any missing Assets/Accessories/Consumables/Components tables">
					<RefreshCw size={14} />
					Sync built-in types
				</button>
			</form>
			<a href={`/o/${data.organization.slug}`} class="btn btn-outline btn-sm">
				<ExternalLink size={14} />
				View dashboard
			</a>
		</div>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}
	{#if form?.success}
		<div class="alert alert-success text-sm">
			<span>Done.</span>
		</div>
	{/if}

	<section class="space-y-3">
		<h2 class="font-medium">Members</h2>
		<div class="card bg-base-100 shadow">
			<div class="overflow-x-auto">
				<table class="table">
					<tbody>
						{#each data.organization.members as membership (membership.id)}
							<tr class="hover">
								<td>
									<p class="font-medium">{membership.user.name}</p>
									<p class="text-base-content/60 text-sm">{membership.user.email}</p>
								</td>
								<td class="w-40">
									<form method="post" action="?/updateRole" use:enhance>
										<input type="hidden" name="memberId" value={membership.id} />
										<select
											name="role"
											value={membership.role}
											class="select select-sm w-full capitalize"
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
										>
											{#each roleOptions as role (role)}
												<option value={role} class="capitalize">{role}</option>
											{/each}
										</select>
									</form>
								</td>
								<td class="w-24 text-right">
									<form method="post" action="?/removeMember" use:enhance>
										<input type="hidden" name="memberId" value={membership.id} />
										<button class="btn btn-ghost btn-sm text-error">Remove</button>
									</form>
								</td>
							</tr>
						{:else}
							<tr><td class="text-base-content/60">No members yet.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="font-medium">Add member</h2>
		<form method="post" action="?/addMember" use:enhance class="card bg-base-100 shadow">
			<div class="card-body flex-row flex-wrap items-end gap-3 py-4">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">User</legend>
					<select name="userId" required class="select">
						<option value="" disabled selected>Select a user</option>
						{#each availableUsers as u (u.id)}
							<option value={u.id}>{u.name} ({u.email})</option>
						{/each}
					</select>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Role</legend>
					<select name="role" class="select capitalize">
						{#each roleOptions as role (role)}
							<option value={role} class="capitalize">{role}</option>
						{/each}
					</select>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend" aria-hidden="true">&nbsp;</legend>
					<button class="btn btn-primary">Add member</button>
				</fieldset>
			</div>
		</form>
		<p class="text-base-content/60 text-xs">
			Need a new user first? Create one on the
			<a href="/admin/users" class="link link-primary">Users</a> page.
		</p>
	</section>
</div>
