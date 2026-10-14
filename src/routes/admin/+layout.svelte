<script lang="ts">
	import { Building, Gauge, Settings, Users } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import type { LayoutServerData } from './$types';

	let { data, children }: { data: LayoutServerData; children: Snippet } = $props();

	// Gauge (not LayoutDashboard, which the per-org "Dashboard" nav item already uses) keeps this
	// instance-wide "Quick View" visually distinct from a regular org's own dashboard.
	const navItems = [
		{ href: '/admin', label: 'Quick View', icon: Gauge },
		{ href: '/admin/organizations', label: 'Organizations', icon: Building },
		{ href: '/admin/users', label: 'Users', icon: Users },
		{ href: '/admin/settings', label: 'Settings', icon: Settings }
	];
</script>

<AppShell {navItems} user={data.user}>
	{#snippet center()}
		<span class="badge badge-ghost badge-sm">Instance admin</span>
	{/snippet}
	{@render children()}
</AppShell>
