<script lang="ts">
	import { Building, Gauge, History, Settings, Users } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import { getSidebarState } from '$lib/stores/sidebar.svelte';
	import { CHANGELOG } from '$lib/changelog';
	import type { LayoutServerData } from './$types';

	let { data, children }: { data: LayoutServerData; children: Snippet } = $props();

	const sidebar = getSidebarState();
	let historyDialog: HTMLDialogElement;

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
	{#snippet sidebarFooter()}
		<div class="border-base-300 text-base-content/40 border-t px-3 py-2 text-xs">
			{#if sidebar.collapsed}
				<button
					type="button"
					class="hover:text-base-content/70 tooltip tooltip-right block w-full text-center"
					data-tip="v{__APP_VERSION__} — version history"
					onclick={() => historyDialog.showModal()}
				>
					<History size={14} class="mx-auto" />
				</button>
			{:else}
				<div class="flex items-center justify-between gap-2">
					<span>v{__APP_VERSION__}</span>
					<button
						type="button"
						class="hover:text-base-content/70 link link-hover inline-flex items-center gap-1"
						onclick={() => historyDialog.showModal()}
					>
						<History size={12} />
						Version history
					</button>
				</div>
			{/if}
		</div>
	{/snippet}
	{@render children()}
</AppShell>

<dialog bind:this={historyDialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-semibold">Version history</h3>
		<div class="mt-4 max-h-96 space-y-6 overflow-y-auto">
			{#each CHANGELOG as entry (entry.version)}
				<div>
					<div class="flex items-baseline gap-2">
						<span class="font-semibold">v{entry.version}</span>
						<span class="text-base-content/50 text-xs">{entry.date}</span>
					</div>
					<ul class="text-base-content/70 mt-1 list-disc space-y-1 pl-5 text-sm">
						{#each entry.changes as change, i (i)}
							<li>{change}</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
		<div class="modal-action">
			<button type="button" class="btn" onclick={() => historyDialog.close()}>Close</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
