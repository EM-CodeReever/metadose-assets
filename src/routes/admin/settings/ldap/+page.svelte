<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { CircleX, Plug, RefreshCw } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const ROLE_OPTIONS = ['owner', 'admin', 'manager', 'viewer', 'member'];
	let syncOrganizationId = $state(untrack(() => data.ldap.defaultOrganizationId));
	let syncRole = $state(untrack(() => data.ldap.defaultRole || 'member'));
</script>

<div class="mx-auto max-w-6xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<a href="/admin/settings" class="link link-primary text-sm">&larr; Settings</a>
		<h1 class="text-lg font-semibold">LDAP</h1>
		<p class="text-base-content/60 text-sm">
			Connect a directory server to sync users in. Matched by email — existing accounts are
			left alone, new ones get a random password and an email to set their own.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="card bg-base-100 shadow lg:col-span-2">
			<div class="card-body space-y-4">
				<form method="post" action="?/save" use:enhance class="space-y-4">
					<label class="label cursor-pointer justify-start gap-2">
						<input type="checkbox" name="enabled" class="checkbox checkbox-sm" checked={data.ldap.enabled} />
						<span class="label-text">Enabled</span>
					</label>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Server URL</legend>
							<input name="url" value={data.ldap.url} placeholder="ldaps://dc.example.com:636" class="input w-full" />
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Search base</legend>
							<input
								name="searchBase"
								value={data.ldap.searchBase}
								placeholder="ou=people,dc=example,dc=com"
								class="input w-full"
							/>
						</fieldset>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Bind DN</legend>
							<input
								name="bindDn"
								value={data.ldap.bindDn}
								placeholder="cn=admin,dc=example,dc=com"
								class="input w-full"
							/>
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Bind password</legend>
							<input
								type="password"
								name="bindPassword"
								placeholder={data.ldap.hasBindPassword ? '••••••••  (unchanged)' : ''}
								class="input w-full"
							/>
						</fieldset>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">User filter</legend>
							<input name="userFilter" value={data.ldap.userFilter} class="input w-full" />
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Email attribute</legend>
							<input name="emailAttribute" value={data.ldap.emailAttribute} class="input w-full" />
						</fieldset>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Name attribute</legend>
							<input name="nameAttribute" value={data.ldap.nameAttribute} class="input w-full" />
						</fieldset>
					</div>

					<div class="border-base-300 border-t pt-4">
						<p class="text-base-content/60 mb-2 text-sm">Default organization/role for a sync, unless overridden below.</p>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Organization</legend>
								<select name="defaultOrganizationId" class="select w-full">
									<option value="">None</option>
									{#each data.organizations as org (org.id)}
										<option value={org.id} selected={data.ldap.defaultOrganizationId === org.id}>{org.name}</option>
									{/each}
								</select>
							</fieldset>
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Role</legend>
								<select name="defaultRole" class="select w-full">
									{#each ROLE_OPTIONS as r (r)}
										<option value={r} selected={data.ldap.defaultRole === r}>{r}</option>
									{/each}
								</select>
							</fieldset>
						</div>
					</div>

					{#if form?.message && !form?.tested && !form?.synced}
						<div class="alert alert-error text-sm">
							<span>{form.message}</span>
						</div>
					{/if}
					{#if form?.success && !form?.tested && !form?.synced}
						<div class="alert alert-success text-sm">
							<span>Saved.</span>
						</div>
					{/if}

					<button type="submit" class="btn btn-primary">Save</button>
				</form>
			</div>
		</div>

		<div class="space-y-6">
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					<h2 class="card-title text-base">Test connection</h2>
					<form method="post" action="?/test" use:enhance>
						<button type="submit" class="btn btn-outline btn-sm w-full">
							<Plug size={14} />
							Test connection
						</button>
					</form>
					{#if form?.tested}
						{#if form?.success}
							<p class="text-success text-sm">Connected and bound successfully.</p>
						{:else if form?.message}
							<p class="text-error text-sm">{form.message}</p>
						{/if}
					{/if}
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					<h2 class="card-title text-base">Sync now</h2>
					<p class="text-base-content/60 text-sm">
						Pulls every user matching the filter above, right now (not scheduled).
					</p>
					<form method="post" action="?/sync" use:enhance class="space-y-4">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Add to organization</legend>
							<select name="organizationId" bind:value={syncOrganizationId} class="select w-full">
								<option value="">Don't add to an organization</option>
								{#each data.organizations as org (org.id)}
									<option value={org.id}>{org.name}</option>
								{/each}
							</select>
						</fieldset>
						{#if syncOrganizationId}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Role</legend>
								<select name="role" bind:value={syncRole} class="select w-full">
									{#each ROLE_OPTIONS as r (r)}
										<option value={r}>{r}</option>
									{/each}
								</select>
							</fieldset>
						{/if}
						<button type="submit" class="btn btn-primary btn-sm w-full">
							<RefreshCw size={14} />
							Sync now
						</button>
					</form>

					{#if form?.synced}
						{#if form?.success}
							<div class="alert {form.failed > 0 ? 'alert-warning' : 'alert-success'} text-sm">
								<span>
									Created/added {form.created} user{form.created === 1 ? '' : 's'}.
									{#if form.failed > 0}{form.failed} row{form.failed === 1 ? '' : 's'} failed.{/if}
								</span>
							</div>
							{#if form.errors?.length > 0}
								<ul class="divide-base-300 divide-y text-sm">
									{#each form.errors as err (err.row)}
										<li class="flex items-start gap-2 py-2">
											<CircleX size={14} class="text-error mt-0.5 shrink-0" />
											<span>{err.message}</span>
										</li>
									{/each}
								</ul>
							{/if}
						{:else if form?.message}
							<div class="alert alert-error text-sm">
								<span>{form.message}</span>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
