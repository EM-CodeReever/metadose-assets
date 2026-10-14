<script lang="ts">
	import { enhance } from '$app/forms';
	import { Send } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<div class="mx-auto max-w-6xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<a href="/admin/settings" class="link link-primary text-sm">&larr; Settings</a>
		<h1 class="text-lg font-semibold">Email (SMTP)</h1>
		<p class="text-base-content/60 text-sm">
			Used for password resets and member-added notifications. Leave the host blank to
			disable sending — emails are logged to the server console instead.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="card bg-base-100 shadow lg:col-span-2">
			<div class="card-body space-y-4">
				<form method="post" action="?/save" use:enhance class="space-y-4">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<fieldset class="fieldset sm:col-span-2">
							<legend class="fieldset-legend">Host</legend>
							<input name="host" value={data.smtp.host} placeholder="smtp.example.com" class="input w-full" />
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Port</legend>
							<input name="port" value={data.smtp.port} placeholder="587" class="input w-full" />
						</fieldset>
					</div>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">From address</legend>
							<input name="from" value={data.smtp.from} placeholder="no-reply@example.com" class="input w-full" />
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Username</legend>
							<input name="user" value={data.smtp.user} class="input w-full" />
						</fieldset>
					</div>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Password</legend>
						<input
							type="password"
							name="password"
							placeholder={data.smtp.hasPassword ? '••••••••  (unchanged)' : ''}
							class="input w-full"
						/>
						{#if data.smtp.hasPassword}
							<p class="text-base-content/50 text-xs">Leave blank to keep the saved password.</p>
						{/if}
					</fieldset>
					<label class="label cursor-pointer justify-start gap-2">
						<input type="checkbox" name="secure" class="checkbox checkbox-sm" checked={data.smtp.secure} />
						<span class="label-text">Use TLS (usually for port 465)</span>
					</label>

					{#if form?.message && !form?.tested}
						<div class="alert alert-error text-sm">
							<span>{form.message}</span>
						</div>
					{/if}
					{#if form?.success && !form?.tested}
						<div class="alert alert-success text-sm">
							<span>Saved.</span>
						</div>
					{/if}

					<button type="submit" class="btn btn-primary">Save</button>
				</form>
			</div>
		</div>

		<div class="card bg-base-100 shadow">
			<div class="card-body space-y-4">
				<h2 class="card-title text-base">Send a test email</h2>
				<form method="post" action="?/test" use:enhance class="space-y-4">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">To</legend>
						<input name="testEmail" type="email" placeholder="you@example.com" class="input w-full" />
					</fieldset>
					<button type="submit" class="btn btn-outline btn-sm w-full">
						<Send size={14} />
						Send test
					</button>
				</form>
				{#if form?.tested}
					{#if form?.success}
						<p class="text-success text-sm">Test email sent to {form.testEmail}.</p>
					{:else if form?.message}
						<p class="text-error text-sm">{form.message}</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>
