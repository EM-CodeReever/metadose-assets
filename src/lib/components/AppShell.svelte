<script lang="ts">
	import { BookOpen, LogOut, PanelLeftClose, PanelLeftOpen } from '@lucide/svelte';
	import { page } from '$app/state';
	import type { Component, Snippet } from 'svelte';
	import Logo from '$lib/brand/components/Logo.svelte';
	import BrandLogo from '$lib/components/BrandLogo.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import { getSidebarState, toggleSidebar } from '$lib/stores/sidebar.svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: Component;
	}

	let {
		navItems,
		user,
		leftExtra,
		center,
		userBadge,
		extraNav,
		bottomNavItems = [],
		children
	}: {
		navItems: NavItem[];
		user: { name: string; email: string };
		leftExtra?: Snippet;
		center?: Snippet;
		userBadge?: Snippet;
		extraNav?: Snippet;
		bottomNavItems?: NavItem[];
		children: Snippet;
	} = $props();

	const sidebar = getSidebarState();
</script>

<div class="bg-base-200 flex h-screen overflow-hidden">
	<aside
		class="bg-base-100 border-base-300 flex h-full shrink-0 flex-col border-r transition-all duration-200 {sidebar.collapsed
			? 'w-16'
			: 'w-64'}"
	>
		<div class="border-base-300 flex h-16 shrink-0 items-center justify-center border-b px-2">
			{#if sidebar.collapsed}
				<Logo iconOnly width={28} />
			{:else}
				<BrandLogo width={100} />
			{/if}
		</div>
		<ul class="menu w-full flex-1 flex-nowrap gap-1 overflow-y-auto overflow-x-hidden p-2">
			{#each navItems as item (item.href)}
				<li>
					<a
						href={item.href}
						class:menu-active={page.url.pathname === item.href}
						class:tooltip={sidebar.collapsed}
						class:tooltip-right={sidebar.collapsed}
						class:justify-center={sidebar.collapsed}
						data-tip={item.label}
					>
						<item.icon size={18} />
						{#if !sidebar.collapsed}
							<span>{item.label}</span>
						{/if}
					</a>
				</li>
			{/each}
			{@render extraNav?.()}
		</ul>
		{#if bottomNavItems.length > 0}
			<ul class="menu border-base-300 w-full flex-nowrap gap-1 border-t p-2">
				{#each bottomNavItems as item (item.href)}
					<li>
						<a
							href={item.href}
							class:menu-active={page.url.pathname === item.href}
							class:tooltip={sidebar.collapsed}
							class:tooltip-right={sidebar.collapsed}
							class:justify-center={sidebar.collapsed}
							data-tip={item.label}
						>
							<item.icon size={18} />
							{#if !sidebar.collapsed}
								<span>{item.label}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>

	<div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
		<div class="navbar bg-base-100 border-base-300 shrink-0 border-b px-4">
			<div class="flex flex-none items-center gap-2">
				<button
					type="button"
					class="btn btn-ghost btn-square"
					aria-label={sidebar.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					onclick={toggleSidebar}
				>
					{#if sidebar.collapsed}
						<PanelLeftOpen size={20} />
					{:else}
						<PanelLeftClose size={20} />
					{/if}
				</button>
				{#if leftExtra}
					<!-- A plain line, not daisyUI's `divider` component — that's built for splitting text
					with two independently-sized line segments either side, which rendered visibly
					asymmetric here with no text between them. -->
				<div class="bg-base-300 h-6 w-0.5 self-center"></div>
					{@render leftExtra()}
				{/if}
			</div>
			<div class="flex flex-1 items-center justify-center gap-2">
				{@render center?.()}
			</div>
			<div class="flex flex-none items-center gap-2">
				<a href="/docs" class="btn btn-ghost btn-square" aria-label="Documentation" title="Documentation">
					<BookOpen size={20} />
				</a>
				<ThemeSwitcher />
				{@render userBadge?.()}
				<div class="hidden text-right leading-tight sm:block">
					<p class="text-sm font-medium">{user.name}</p>
					<p class="text-base-content/50 text-xs">{user.email}</p>
				</div>
				<form method="post" action="/logout">
					<button type="submit" class="btn btn-ghost btn-square" aria-label="Sign out">
						<LogOut size={18} />
					</button>
				</form>
			</div>
		</div>
		<main class="min-w-0 flex-1 overflow-y-auto px-6 py-8">
			{@render children()}
		</main>
	</div>
</div>
