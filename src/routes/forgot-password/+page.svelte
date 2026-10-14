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
				<h1 class="card-title text-2xl">Forgot password</h1>

				{#if form?.success}
					<p class="text-base-content/70 mt-2 text-sm">
						If that email exists, we've sent a link to reset your password.
					</p>
				{:else}
					<p class="text-base-content/60 mt-1 text-sm">
						Enter your email and we'll send you a reset link.
					</p>
					<form method="post" use:enhance class="mt-2 space-y-4">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Email</legend>
							<input type="email" name="email" required class="input w-full" />
						</fieldset>
						<button type="submit" class="btn btn-primary w-full">Send reset link</button>
					</form>
				{/if}

				<a href="/login" class="link link-primary mt-2 text-sm">&larr; Back to sign in</a>
			</div>
		</div>
	</div>
</div>
