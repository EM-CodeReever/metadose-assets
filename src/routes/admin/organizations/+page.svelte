<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, ScrollText } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-lg font-semibold">Organizations</h1>
		<p class="text-base-content/60 text-sm">
			Every organization is a tenant with its own asset schemas and members.
		</p>
	</div>

	<form method="post" action="?/create" use:enhance class="card bg-base-100 shadow">
		<div class="card-body flex-row flex-wrap items-end gap-3 py-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Name</legend>
				<input name="name" required class="input" />
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Slug (optional)</legend>
				<input name="slug" placeholder="auto-generated from name" class="input" />
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend" aria-hidden="true">&nbsp;</legend>
				<button class="btn btn-primary">Create organization</button>
			</fieldset>
		</div>
	</form>
	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<div class="card bg-base-100 shadow">
		<div class="overflow-x-auto">
			<table class="table">
				<tbody>
					{#each data.organizations as org (org.id)}
						<tr class="hover">
							<td>
								<a href={`/admin/organizations/${org.id}`} class="link link-hover font-medium">
									{org.name}
								</a>
							</td>
							<td class="text-base-content/60 text-sm">
								{org.members.length} member{org.members.length === 1 ? '' : 's'}
							</td>
							<td class="text-right">
								<a href={`/o/${org.slug}`} class="btn btn-ghost btn-xs" title="Open dashboard">
									<ExternalLink size={14} />
									Dashboard
								</a>
								<a href={`/o/${org.slug}/logs`} class="btn btn-ghost btn-xs" title="View logs">
									<ScrollText size={14} />
									Logs
								</a>
							</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="text-base-content/60">No organizations yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
