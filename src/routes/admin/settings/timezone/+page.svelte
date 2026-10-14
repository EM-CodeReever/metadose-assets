<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<div class="max-w-2xl space-y-6">
	<div>
		<a href="/admin/settings" class="link link-primary text-sm">&larr; Settings</a>
		<h1 class="text-lg font-semibold">Timezone</h1>
		<p class="text-base-content/60 text-sm">
			Every date and time shown across the app uses this zone instead of each viewer's own
			browser/OS setting — useful for keeping timestamps consistent on a shared deployment.
		</p>
	</div>

	<div class="card bg-base-100 shadow">
		<div class="card-body space-y-4">
			<form method="post" action="?/save" use:enhance class="space-y-4">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Timezone</legend>
					<select name="timezone" class="select w-full">
						<option value="">Use each viewer's own browser/OS timezone</option>
						{#each data.zones as zone (zone)}
							<option value={zone} selected={data.timezone === zone}>{zone}</option>
						{/each}
					</select>
				</fieldset>

				{#if form?.message}
					<div class="alert alert-error text-sm">
						<span>{form.message}</span>
					</div>
				{/if}
				{#if form?.success}
					<div class="alert alert-success text-sm">
						<span>Saved.</span>
					</div>
				{/if}

				<button type="submit" class="btn btn-primary">Save</button>
			</form>
		</div>
	</div>
</div>
