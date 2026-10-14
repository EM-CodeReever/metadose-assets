<script lang="ts">
	import { enhance } from '$app/forms';
	import BrandLogo from '$lib/components/BrandLogo.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="bg-base-200 flex min-h-screen items-center justify-center px-4">
	<div class="absolute top-4 right-4">
		<ThemeSwitcher />
	</div>

	<div class="w-full max-w-sm space-y-6">
		<div class="flex justify-center text-xl">
			<BrandLogo />
		</div>

		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h1 class="card-title text-2xl">Set a new password</h1>
				<p class="text-base-content/60 text-sm">
					Your administrator set a temporary password for your account. Choose a new one to continue.
				</p>

				<form method="post" use:enhance class="mt-2 space-y-4">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Current password</legend>
						<input type="password" name="currentPassword" required class="input w-full" />
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">New password</legend>
						<input type="password" name="newPassword" required minlength="8" class="input w-full" />
					</fieldset>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Confirm new password</legend>
						<input type="password" name="confirmPassword" required minlength="8" class="input w-full" />
					</fieldset>
					{#if form?.message}
						<div class="alert alert-error text-sm">
							<span>{form.message}</span>
						</div>
					{/if}
					<button type="submit" class="btn btn-primary w-full">Set new password</button>
				</form>

				<form method="post" action="/logout" class="mt-3">
					<button type="submit" class="link link-primary text-sm">Sign out instead</button>
				</form>
			</div>
		</div>
	</div>
</div>
