<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight, Plug, RefreshCw } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const ROLE_OPTIONS = ['owner', 'admin', 'manager', 'viewer', 'member'];
	let testingConnection = $state(false);
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
						<p class="text-base-content/60 mb-2 text-sm">Default organization/role for a sync, unless overridden there.</p>
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

					<div class="border-base-300 border-t pt-4">
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Sync from groups (optional)</legend>
							<textarea
								name="groupDns"
								rows="3"
								class="textarea w-full font-mono text-xs"
								placeholder={'cn=engineering,ou=groups,dc=example,dc=com\ncn=sales,ou=groups,dc=example,dc=com'}
							>{data.ldap.groupDns}</textarea>
							<p class="text-base-content/50 text-xs">
								One group DN per line. When set, the sync page lets you pick these groups as
								extra sources alongside (or instead of) the OU/filter above.
							</p>
						</fieldset>
					</div>

					<div class="block">
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
					</div>

					<div class="flex justify-end pt-2">
						<button type="submit" class="btn btn-primary">Save</button>
					</div>
				</form>
			</div>
		</div>

		<div class="space-y-6">
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					<h2 class="card-title text-base">Test connection</h2>
					<form
						method="post"
						action="?/test"
						use:enhance={() => {
							testingConnection = true;
							return async ({ update }) => {
								await update();
								testingConnection = false;
							};
						}}
					>
						<button type="submit" class="btn btn-outline btn-sm w-full" disabled={testingConnection}>
							{#if testingConnection}
								<span class="loading loading-spinner loading-xs"></span>
								Testing...
							{:else}
								<Plug size={14} />
								Test connection
							{/if}
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
					<h2 class="card-title text-base">Sync users</h2>
					<p class="text-base-content/60 text-sm">
						Search first, then pick exactly who to bring in — a dedicated page so you can review
						matches before anything is created.
					</p>
					<a href="/admin/settings/ldap/sync" class="btn btn-primary btn-sm w-full">
						<RefreshCw size={14} />
						Go to LDAP sync
						<ArrowRight size={14} />
					</a>
				</div>
			</div>
		</div>
	</div>
</div>
