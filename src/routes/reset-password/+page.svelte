<script lang="ts">
	import { enhance } from '$app/forms';
	import BrandLogo from '$lib/components/BrandLogo.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
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
				<h1 class="card-title text-2xl">Reset password</h1>

				{#if data.invalid}
					<p class="text-base-content/70 mt-2 text-sm">
						This reset link is invalid or has expired.
					</p>
					<a href="/forgot-password" class="link link-primary mt-2 text-sm">Request a new link</a>
				{:else}
					<form method="post" use:enhance class="mt-2 space-y-4">
						<input type="hidden" name="token" value={data.token} />
						<fieldset class="fieldset">
							<legend class="fieldset-legend">New password</legend>
							<input type="password" name="newPassword" required minlength="8" class="input w-full" />
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Confirm password</legend>
							<input type="password" name="confirmPassword" required minlength="8" class="input w-full" />
						</fieldset>
						{#if form?.message}
							<div class="alert alert-error text-sm">
								<span>{form.message}</span>
							</div>
						{/if}
						<button type="submit" class="btn btn-primary w-full">Reset password</button>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>
