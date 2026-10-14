<script lang="ts">
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import { orgRoleBadgeClass } from '$lib/badgeStyles';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="bg-base-200 min-h-screen">
	<div class="mx-auto max-w-lg space-y-4 p-8">
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-semibold">Your organizations</h1>
			<ThemeSwitcher />
		</div>

		{#if data.memberships.length === 0}
			<div class="alert">
				<span>
					You don't belong to any organization yet. Ask your administrator to add you as a
					member.
				</span>
			</div>
		{:else}
			<ul class="menu bg-base-100 rounded-box w-full shadow">
				{#each data.memberships as membership (membership.id)}
					<li>
						<a href={`/o/${membership.organization.slug}`} class="flex items-center justify-between">
							<span class="font-medium">{membership.organization.name}</span>
							<span class="badge capitalize {orgRoleBadgeClass(membership.role)}">{membership.role}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		<form method="post" action="/logout">
			<button class="btn btn-ghost btn-sm">Sign out</button>
		</form>
	</div>
</div>
