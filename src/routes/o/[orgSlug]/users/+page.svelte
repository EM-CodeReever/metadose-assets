<script lang="ts">
	import { KeyRound, Network, Search, ShieldCheck, Users as UsersIcon } from '@lucide/svelte';
	import { orgRoleBadgeClass, orgRoleIcon } from '$lib/badgeStyles';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	const ORG_ROLES = ['owner', 'admin', 'manager', 'viewer', 'member'] as const;

	let searchQuery = $state('');
	let roleFilter = $state<'all' | (typeof ORG_ROLES)[number]>('all');
	let authFilter = $state<'all' | 'local' | 'ldap'>('all');

	const filteredMembers = $derived(
		data.members.filter((m) => {
			const matchesRole = roleFilter === 'all' || m.role === roleFilter;
			const matchesAuth = authFilter === 'all' || (m.user.authSource ?? 'local') === authFilter;
			const q = searchQuery.trim().toLowerCase();
			const matchesSearch = !q || m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q);
			return matchesRole && matchesAuth && matchesSearch;
		})
	);
</script>

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<UsersIcon size={20} class="text-primary" />
		<div>
			<h1 class="text-lg font-semibold">Users</h1>
			<p class="text-base-content/60 text-sm">
				Everyone with access to {data.organization.name} — their role, auth method, and what's assigned to them.
			</p>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<label class="input input-sm">
			<Search size={14} class="opacity-50" />
			<input type="text" placeholder="Search by name or email" bind:value={searchQuery} />
		</label>
		<select class="select select-sm w-auto" bind:value={roleFilter}>
			<option value="all">All roles</option>
			{#each ORG_ROLES as r (r)}
				<option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
			{/each}
		</select>
		<select class="select select-sm w-auto" bind:value={authFilter}>
			<option value="all">All auth methods</option>
			<option value="local">Local</option>
			<option value="ldap">LDAP</option>
		</select>
		<span class="text-base-content/50 text-sm">
			{filteredMembers.length} of {data.members.length}
		</span>
	</div>

	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr class="bg-base-200">
						<th class="text-xs font-semibold tracking-wider uppercase">Name</th>
						<th class="text-xs font-semibold tracking-wider uppercase">Email</th>
						<th class="text-xs font-semibold tracking-wider uppercase">Role</th>
						<th class="text-xs font-semibold tracking-wider uppercase">Auth</th>
						<th class="text-xs font-semibold tracking-wider uppercase text-right">Checked out</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredMembers as m (m.id)}
						{@const RoleIcon = orgRoleIcon(m.role)}
						<tr
							class="hover cursor-pointer"
							onclick={() => (window.location.href = `/o/${data.organization.slug}/users/${m.id}`)}
						>
							<td>
								<a href={`/o/${data.organization.slug}/users/${m.id}`} class="link link-hover font-medium">
									{m.user.name}
								</a>
							</td>
							<td class="text-base-content/70 text-sm">{m.user.email}</td>
							<td>
								<span class="badge {orgRoleBadgeClass(m.role)} badge-sm gap-1 font-normal capitalize">
									<RoleIcon size={12} />
									{m.role}
								</span>
								{#if m.user.role === 'super_admin'}
									<span class="badge badge-warning badge-sm gap-1 font-normal" title="Instance admin">
										<ShieldCheck size={11} />
									</span>
								{/if}
							</td>
							<td>
								{#if m.user.authSource === 'ldap'}
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
							<td class="text-right">
								{#if m.openCheckoutCount > 0}
									<span class="badge badge-ghost badge-sm">{m.openCheckoutCount}</span>
								{:else}
									<span class="text-base-content/40">—</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="text-base-content/60">
								{data.members.length === 0 ? 'No members yet.' : 'No users match your filters.'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
