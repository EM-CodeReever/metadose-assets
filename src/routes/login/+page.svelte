<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Boxes, ClipboardList, ScrollText, ShieldCheck, User } from '@lucide/svelte';
	import AuthShell from '$lib/brand/components/AuthShell.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let tab = $state<'user' | 'admin'>(untrack(() => (form?.tab as 'user' | 'admin' | undefined) ?? data.defaultTab));

	const features = [
		{ icon: Boxes, text: 'Assets, accessories, consumables & your own custom types' },
		{ icon: ClipboardList, text: 'Request and approve checkouts instead of spreadsheets' },
		{ icon: ScrollText, text: 'A full, filterable activity log for every organization' }
	];
</script>

<AuthShell
	appSuffix="assets"
	tagline="Know where everything is, always."
	description="Track every asset, accessory and consumable across every team — who has what, where it's been, and what's due back."
	{features}
>
	{#snippet topRight()}
		<ThemeSwitcher />
	{/snippet}

	<div class="w-full max-w-sm space-y-6">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h1 class="card-title text-2xl">Sign in</h1>

				<div class="join mt-2 w-full">
					<label class="join-item btn btn-sm flex-1 gap-1.5" class:btn-info={tab === 'user'}>
						<input type="radio" name="login-tab" value="user" class="hidden" bind:group={tab} />
						<User size={14} />
						User
					</label>
					<label class="join-item btn btn-sm flex-1 gap-1.5" class:btn-secondary={tab === 'admin'}>
						<input type="radio" name="login-tab" value="admin" class="hidden" bind:group={tab} />
						<ShieldCheck size={14} />
						INT Admin
					</label>
				</div>

				{#if tab === 'user'}
					<form method="post" action="?/user" use:enhance class="mt-4 space-y-4">
						<input type="hidden" name="redirectTo" value={data.redirectTo} />
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Organization</legend>
							<select name="organizationId" required class="select w-full">
								<option value="" disabled selected={!form?.organizationId}>Select your organization</option>
								{#each data.organizations as org (org.id)}
									<option value={org.id} selected={form?.organizationId === org.id}>{org.name}</option>
								{/each}
							</select>
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Email</legend>
							<input
								type="email"
								name="email"
								required
								value={form?.tab === 'user' ? (form?.email ?? '') : ''}
								class="input w-full"
							/>
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Password</legend>
							<input type="password" name="password" required class="input w-full" />
						</fieldset>
						{#if form?.tab === 'user' && form?.message}
							<div class="alert alert-error text-sm">
								<span>{form.message}</span>
							</div>
						{/if}
						<button type="submit" class="btn btn-primary w-full"> Sign in </button>
					</form>
				{:else}
					<form method="post" action="?/admin" use:enhance class="mt-4 space-y-4">
						<input type="hidden" name="redirectTo" value={data.redirectTo} />
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Email</legend>
							<input
								type="email"
								name="email"
								required
								value={form?.tab === 'admin' ? (form?.email ?? '') : ''}
								class="input w-full"
							/>
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Password</legend>
							<input type="password" name="password" required class="input w-full" />
						</fieldset>
						{#if form?.tab === 'admin' && form?.message}
							<div class="alert alert-error text-sm">
								<span>{form.message}</span>
							</div>
						{/if}
						<button type="submit" class="btn btn-primary w-full"> Sign in </button>
					</form>
				{/if}

				<a href="/forgot-password" class="link link-primary mt-3 text-sm">Forgot your password?</a>
				{#if tab === 'user'}
					<p class="text-base-content/60 mt-2 text-xs">
						Accounts are created by your administrator — there is no self-service sign-up.
					</p>
				{/if}
			</div>
		</div>
	</div>
</AuthShell>
