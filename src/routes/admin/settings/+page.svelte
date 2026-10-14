<script lang="ts">
	import { Clock, Mail, Network } from '@lucide/svelte';

	const CARDS = [
		{
			href: '/admin/settings/smtp',
			icon: Mail,
			title: 'Email (SMTP)',
			description: 'Outgoing mail for password resets and member notifications.'
		},
		{
			href: '/admin/settings/ldap',
			icon: Network,
			title: 'LDAP',
			description: 'Connect a directory server and sync users in.'
		},
		{
			href: '/admin/settings/timezone',
			icon: Clock,
			title: 'Timezone',
			description: 'The zone every date/time across the app is shown in.'
		}
	];
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-lg font-semibold">Settings</h1>
		<p class="text-base-content/60 text-sm">Instance-wide configuration for this deployment.</p>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each CARDS as card (card.href)}
			<a href={card.href} class="card bg-base-100 shadow transition-shadow hover:shadow-md">
				<div class="card-body">
					<card.icon size={24} class="text-primary" />
					<h2 class="card-title text-base">{card.title}</h2>
					<p class="text-base-content/60 text-sm">{card.description}</p>
				</div>
			</a>
		{/each}
	</div>
</div>
