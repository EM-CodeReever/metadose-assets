<script lang="ts">
	import { Building, ExternalLink, Gauge, Settings, ShieldCheck, Users } from '@lucide/svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	function formatDate(value: string | Date): string {
		return new Date(value).toLocaleDateString();
	}

	const QUICK_LINKS = [
		{ href: '/admin/organizations', icon: Building, title: 'Organizations', description: 'Create and manage tenant organizations.' },
		{ href: '/admin/users', icon: Users, title: 'Users', description: 'Create, bulk import, and manage instance users.' },
		{ href: '/admin/settings', icon: Settings, title: 'Settings', description: 'SMTP, LDAP, and other instance-wide config.' }
	];
</script>

<div class="space-y-6">
	<div class="border-secondary/30 bg-secondary/5 flex items-center gap-3 rounded-box border px-4 py-3">
		<Gauge size={28} class="text-secondary shrink-0" />
		<div>
			<h1 class="text-lg font-semibold">Quick View</h1>
			<p class="text-base-content/60 text-sm">An at-a-glance look across every organization on this instance.</p>
		</div>
	</div>

	<div class="stats bg-base-100 w-full shadow">
		<div class="stat">
			<div class="stat-figure text-secondary"><Building size={24} /></div>
			<div class="stat-title">Organizations</div>
			<div class="stat-value">{data.organizationCount}</div>
		</div>
		<div class="stat">
			<div class="stat-figure text-secondary"><Users size={24} /></div>
			<div class="stat-title">Users</div>
			<div class="stat-value">{data.userCount}</div>
		</div>
		<div class="stat">
			<div class="stat-figure text-secondary"><ShieldCheck size={24} /></div>
			<div class="stat-title">Instance admins</div>
			<div class="stat-value">{data.superAdminCount}</div>
		</div>
	</div>

	<section class="space-y-3">
		<h2 class="font-medium">Quick links</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each QUICK_LINKS as link (link.href)}
				<a href={link.href} class="card bg-base-100 shadow transition-shadow hover:shadow-md">
					<div class="card-body">
						<link.icon size={24} class="text-secondary" />
						<h3 class="card-title text-base">{link.title}</h3>
						<p class="text-base-content/60 text-sm">{link.description}</p>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<div class="grid gap-6 lg:grid-cols-2">
		<section class="space-y-3">
			<div class="flex items-center justify-between">
				<h2 class="font-medium">Recent organizations</h2>
				<a href="/admin/organizations" class="link link-secondary text-sm">View all</a>
			</div>
			<div class="card bg-base-100 shadow">
				<div class="overflow-x-auto">
					<table class="table">
						<tbody>
							{#each data.recentOrganizations as org (org.id)}
								<tr class="hover">
									<td>
										<a href={`/admin/organizations/${org.id}`} class="link link-hover font-medium">
											{org.name}
										</a>
									</td>
									<td class="text-base-content/60 text-sm">
										{org.members.length} member{org.members.length === 1 ? '' : 's'}
									</td>
									<td class="text-base-content/50 text-right text-sm">{formatDate(org.createdAt)}</td>
									<td class="text-right">
										<a href={`/o/${org.slug}`} class="btn btn-ghost btn-xs" title="Open dashboard">
											<ExternalLink size={14} />
										</a>
									</td>
								</tr>
							{:else}
								<tr><td class="text-base-content/60">No organizations yet.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<section class="space-y-3">
			<div class="flex items-center justify-between">
				<h2 class="font-medium">Recent users</h2>
				<a href="/admin/users" class="link link-secondary text-sm">View all</a>
			</div>
			<div class="card bg-base-100 shadow">
				<div class="overflow-x-auto">
					<table class="table">
						<tbody>
							{#each data.recentUsers as u (u.id)}
								<tr class="hover">
									<td>
										<p class="font-medium">{u.name}</p>
										<p class="text-base-content/60 text-sm">{u.email}</p>
									</td>
									<td class="text-right">
										{#if u.role === 'super_admin'}
											<span class="badge badge-secondary badge-sm">Instance admin</span>
										{:else}
											<span class="badge badge-ghost badge-sm">User</span>
										{/if}
									</td>
								</tr>
							{:else}
								<tr><td class="text-base-content/60">No users yet.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	</div>
</div>
