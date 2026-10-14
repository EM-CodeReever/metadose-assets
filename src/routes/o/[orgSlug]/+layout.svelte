<script lang="ts">
	import {
		ArrowLeftRight,
		Boxes,
		ChartColumn,
		ChevronDown,
		ClipboardList,
		Cpu,
		Folder,
		Keyboard,
		LayoutDashboard,
		Package,
		ScanLine,
		ScrollText,
		Settings,
		Shield
	} from '@lucide/svelte';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import { getSidebarState } from '$lib/stores/sidebar.svelte';
	import { orgRoleButtonClass, orgRoleIcon } from '$lib/badgeStyles';
	import type { LayoutServerData } from './$types';

	let { data, children }: { data: LayoutServerData; children: Snippet } = $props();

	const sidebar = getSidebarState();
	const isMember = $derived(data.membership?.role === 'member');

	// Members only browse what they can request — no Components (can't be requested), no
	// Checkouts/Scan/Reports/schema management.
	const navItems = $derived(
		isMember
			? [
					{ href: `/o/${data.organization.slug}`, label: 'Dashboard', icon: LayoutDashboard },
					{ href: `/o/${data.organization.slug}/${data.singletonSlugs.asset}`, label: 'Assets', icon: Boxes },
					{ href: `/o/${data.organization.slug}/${data.singletonSlugs.accessory}`, label: 'Accessories', icon: Keyboard },
					{ href: `/o/${data.organization.slug}/${data.singletonSlugs.consumable}`, label: 'Consumables', icon: Package }
				]
			: [
					{ href: `/o/${data.organization.slug}`, label: 'Dashboard', icon: LayoutDashboard },
					{ href: `/o/${data.organization.slug}/${data.singletonSlugs.asset}`, label: 'Assets', icon: Boxes },
					{ href: `/o/${data.organization.slug}/${data.singletonSlugs.accessory}`, label: 'Accessories', icon: Keyboard },
					{ href: `/o/${data.organization.slug}/${data.singletonSlugs.consumable}`, label: 'Consumables', icon: Package },
					{ href: `/o/${data.organization.slug}/${data.singletonSlugs.component}`, label: 'Components', icon: Cpu },
					{ href: `/o/${data.organization.slug}/checkouts`, label: 'Checkouts', icon: ArrowLeftRight },
					{ href: `/o/${data.organization.slug}/requests`, label: 'Requests', icon: ClipboardList },
					{ href: `/o/${data.organization.slug}/scan`, label: 'Scan', icon: ScanLine },
					{ href: `/o/${data.organization.slug}/reports`, label: 'Reports', icon: ChartColumn },
					{ href: `/o/${data.organization.slug}/logs`, label: 'Logs', icon: ScrollText }
				]
	);

	const canManageUsers = $derived(
		data.isSuperAdminAccess || data.membership?.role === 'owner' || data.membership?.role === 'admin'
	);

	const manageLinks = $derived([
		...(canManageUsers ? [{ href: `/o/${data.organization.slug}/users`, label: 'Users' }] : []),
		{ href: `/o/${data.organization.slug}/object-types`, label: 'Schema' },
		{ href: `/o/${data.organization.slug}/manage/manufacturers`, label: 'Manufacturers' },
		{ href: `/o/${data.organization.slug}/manage/categories`, label: 'Categories' },
		{ href: `/o/${data.organization.slug}/manage/conditions`, label: 'Conditions' },
		{ href: `/o/${data.organization.slug}/manage/locations`, label: 'Locations' }
	]);

	const bottomNavItems = $derived(
		!isMember && data.user.role === 'super_admin'
			? [{ href: '/admin/organizations', label: 'Admin console', icon: Shield }]
			: []
	);

	const RoleIcon = $derived(data.membership ? orgRoleIcon(data.membership.role) : undefined);
	const roleLabel = $derived(
		data.membership ? data.membership.role.charAt(0).toUpperCase() + data.membership.role.slice(1) : ''
	);
</script>

<AppShell {navItems} {bottomNavItems} user={data.user}>
	{#snippet leftExtra()}
		{#if data.myOrganizations.length > 1}
			<details class="dropdown">
				<summary class="btn btn-ghost btn-sm gap-1 px-2 font-bold">
					{data.organization.name}
					<ChevronDown size={14} />
				</summary>
				<ul class="dropdown-content menu bg-base-100 rounded-box z-10 w-56 p-2 shadow">
					{#each data.myOrganizations as org (org.id)}
						<li>
							<a href={`/o/${org.slug}`} class:menu-active={org.slug === data.organization.slug}>
								{org.name}
							</a>
						</li>
					{/each}
				</ul>
			</details>
		{:else}
			<span class="font-bold">{data.organization.name}</span>
		{/if}
		{#if data.isSuperAdminAccess}
			<span class="badge badge-warning badge-sm">Support access</span>
		{/if}
	{/snippet}

	{#snippet userBadge()}
		{#if data.membership && RoleIcon}
			<div class="tooltip tooltip-bottom" data-tip="{roleLabel} access">
				<div class="btn btn-square btn-sm {orgRoleButtonClass(data.membership.role)}" aria-label="{roleLabel} access">
					<RoleIcon size={16} />
				</div>
			</div>
		{/if}
	{/snippet}

	{#snippet extraNav()}
		{#if isMember}
			<!-- members have nothing under Custom/Manage -->
		{:else if sidebar.collapsed}
			<li>
				<a
					href={`/o/${data.organization.slug}/object-types`}
					class="tooltip tooltip-right justify-center"
					data-tip="Custom"
				>
					<Folder size={18} />
				</a>
			</li>
			<li>
				<a
					href={`/o/${data.organization.slug}/object-types`}
					class="tooltip tooltip-right justify-center"
					data-tip="Manage"
				>
					<Settings size={18} />
				</a>
			</li>
		{:else}
			<li>
				<details open>
					<summary><Folder size={18} /> Custom</summary>
					<ul>
						{#each data.customObjectTypes as ot (ot.id)}
							<li>
								<a
									href={`/o/${data.organization.slug}/${ot.slug}`}
									class:menu-active={page.url.pathname === `/o/${data.organization.slug}/${ot.slug}`}
								>
									{ot.name}
								</a>
							</li>
						{:else}
							<li><span class="text-base-content/50">No custom types yet</span></li>
						{/each}
					</ul>
				</details>
			</li>
			<li>
				<details>
					<summary><Settings size={18} /> Manage</summary>
					<ul>
						{#each manageLinks as link (link.href)}
							<li>
								<a href={link.href} class:menu-active={page.url.pathname === link.href}>
									{link.label}
								</a>
							</li>
						{/each}
					</ul>
				</details>
			</li>
		{/if}
	{/snippet}

	{@render children()}
</AppShell>
