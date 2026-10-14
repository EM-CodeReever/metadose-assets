<script lang="ts">
	import { enhance } from '$app/forms';
	import { Activity, ArrowLeftRight, Boxes, Package, PackageCheck, TriangleAlert, UserRound } from '@lucide/svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let adminViewMode = $state<'admin' | 'member'>('admin');

	const REQUEST_STATUS_BADGE: Record<string, string> = {
		pending: 'badge-ghost',
		fulfilled: 'badge-success',
		rejected: 'badge-error',
		cancelled: 'badge-neutral'
	};

	const ACTIVITY_LABELS: Record<string, string> = {
		'record.created': 'Created',
		'record.updated': 'Updated',
		'record.deleted': 'Deleted',
		'record.checked_out': 'Checked out',
		'record.checked_in': 'Checked in'
	};

	function formatDate(value: string | Date | null | undefined): string {
		if (!value) return '—';
		return new Date(value).toLocaleString();
	}

	function isOverdue(dueAt: string | Date | null): boolean {
		return !!dueAt && new Date(dueAt).getTime() < Date.now();
	}

	type AdminDashboardData = Extract<PageServerData, { isMemberView: false }>;
	function holderName(c: AdminDashboardData['checkouts'][number]): string {
		return c.assignedToUser?.name ?? c.assignedToLocation?.name ?? String(c.assignedToRecord?.data.values.name ?? '—');
	}
</script>

{#if data.isMemberView}
	<div class="space-y-8">
		<div>
			<h1 class="text-lg font-semibold">Welcome to {data.organization.name}</h1>
			<p class="text-base-content/60 text-sm">Your requests and what's currently checked out to you.</p>
		</div>

		{#if data.myCheckouts.some((c) => !c.acceptedAt)}
			<div class="alert alert-warning text-sm">
				<PackageCheck size={16} />
				<span>You have items checked out that need receipt confirmed below.</span>
			</div>
		{/if}

		<section class="space-y-3">
			<h2 class="font-medium">Checked out to you</h2>
			<div class="card bg-base-100 shadow">
				<div class="overflow-x-auto">
					<table class="table">
						<tbody>
							{#each data.myCheckouts as c (c.id)}
								<tr class="hover">
									<td>
										<a
											href={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.recordId}`}
											class="link link-hover"
										>
											{c.record.data.values.name ?? c.record.objectType.name}
										</a>
									</td>
									<td class="text-base-content/60">{c.assignedToLocation?.name ?? '—'}</td>
									<td class="text-right">
										{#if c.acceptedAt}
											<span class="badge badge-ghost badge-sm">Receipt confirmed</span>
										{:else}
											<form method="post" action={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.recordId}?/accept`} use:enhance>
												<input type="hidden" name="checkoutId" value={c.id} />
												<button type="submit" class="btn btn-success btn-xs">Confirm receipt</button>
											</form>
										{/if}
									</td>
								</tr>
							{:else}
								<tr><td class="text-base-content/60">Nothing is currently checked out to you.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="font-medium">Your requests</h2>
			<div class="card bg-base-100 shadow">
				<div class="overflow-x-auto">
					<table class="table">
						<tbody>
							{#each data.myRequests as r (r.id)}
								<tr class="hover">
									<td>
										<a
											href={`/o/${data.organization.slug}/${r.record.objectType.slug}/${r.recordId}`}
											class="link link-hover"
										>
											{r.record.data.values.name ?? r.record.objectType.name}
										</a>
									</td>
									<td>
										<span class="badge badge-sm capitalize {REQUEST_STATUS_BADGE[r.status]}">{r.status}</span>
									</td>
									<td class="text-base-content/50 text-sm">{new Date(r.createdAt).toLocaleString()}</td>
									<td class="text-right">
										{#if r.status === 'pending'}
											<form method="post" action="?/cancelRequest" use:enhance>
												<input type="hidden" name="requestId" value={r.id} />
												<button type="submit" class="btn btn-ghost btn-xs">Cancel</button>
											</form>
										{/if}
									</td>
								</tr>
							{:else}
								<tr><td class="text-base-content/60">You haven't requested anything yet.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	</div>
{:else}
	<div class="space-y-8">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-lg font-semibold">Welcome to {data.organization.name}</h1>
			<p class="text-base-content/60 text-sm">
				{adminViewMode === 'admin'
					? "Here's what's happening across your asset tables."
					: "What's currently checked out to you."}
			</p>
		</div>
		<button
			type="button"
			class="btn btn-outline btn-sm relative"
			onclick={() => (adminViewMode = adminViewMode === 'admin' ? 'member' : 'admin')}
		>
			<UserRound size={14} />
			{adminViewMode === 'admin' ? 'Switch to member view' : 'Switch to admin view'}
			{#if adminViewMode === 'admin' && data.myCheckouts.some((c) => !c.acceptedAt)}
				<span class="absolute -top-1 -right-1 flex h-3 w-3">
					<span class="bg-warning absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
					></span>
					<span class="bg-warning relative inline-flex h-3 w-3 rounded-full"></span>
				</span>
			{/if}
		</button>
	</div>

	{#if adminViewMode === 'member'}
		<section class="space-y-3">
			<h2 class="font-medium">Checked out to you</h2>
			<div class="card bg-base-100 shadow">
				<div class="overflow-x-auto">
					<table class="table">
						<tbody>
							{#each data.myCheckouts as c (c.id)}
								<tr class="hover">
									<td>
										<a
											href={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.recordId}`}
											class="link link-hover"
										>
											{c.record.data.values.name ?? c.record.objectType.name}
										</a>
									</td>
									<td class="text-base-content/60">{c.assignedToLocation?.name ?? '—'}</td>
									<td class="text-right">
										{#if c.acceptedAt}
											<span class="badge badge-ghost badge-sm">Receipt confirmed</span>
										{:else}
											<form
												method="post"
												action={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.recordId}?/accept`}
												use:enhance
											>
												<input type="hidden" name="checkoutId" value={c.id} />
												<button type="submit" class="btn btn-success btn-xs">Confirm receipt</button>
											</form>
										{/if}
									</td>
								</tr>
							{:else}
								<tr><td class="text-base-content/60">Nothing is currently checked out to you.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	{:else}
	<div class="stats bg-base-100 w-full shadow">
		<div class="stat">
			<div class="stat-figure text-primary"><Boxes size={24} /></div>
			<div class="stat-title">Object types</div>
			<div class="stat-value">{data.objectTypes.length}</div>
		</div>
		<div class="stat">
			<div class="stat-figure text-primary"><Package size={24} /></div>
			<div class="stat-title">Total records</div>
			<div class="stat-value">{data.totalRecords}</div>
		</div>
		<div class="stat">
			<div class="stat-figure text-primary"><ArrowLeftRight size={24} /></div>
			<div class="stat-title">Open checkouts</div>
			<div class="stat-value">{data.checkouts.length}</div>
		</div>
		<div class="stat">
			<div class="stat-figure text-error"><TriangleAlert size={24} /></div>
			<div class="stat-title">Overdue</div>
			<div class="stat-value {data.overdueCount > 0 ? 'text-error' : ''}">{data.overdueCount}</div>
		</div>
	</div>

	<section class="space-y-3">
		<h2 class="font-medium">Object types</h2>
		{#if data.objectTypes.length === 0}
			<div class="card bg-base-100 shadow">
				<div class="card-body items-center py-12 text-center">
					<Boxes size={32} class="text-base-content/30" />
					<p class="text-base-content/60">No object types yet.</p>
					<a href={`/o/${data.organization.slug}/object-types`} class="btn btn-primary btn-sm mt-2">
						Create one
					</a>
				</div>
			</div>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
				{#each data.objectTypes as ot (ot.id)}
					<a
						href={`/o/${data.organization.slug}/${ot.slug}`}
						class="card bg-base-100 shadow transition-shadow hover:shadow-md"
					>
						<div class="card-body">
							<h3 class="card-title text-base">{ot.name}</h3>
							<p class="text-base-content/60 text-sm">
								{ot.recordCount} record{ot.recordCount === 1 ? '' : 's'}
							</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<div class="grid gap-6 lg:grid-cols-2">
		<section class="space-y-3">
			<div class="flex items-center justify-between">
				<h2 class="font-medium">Open checkouts</h2>
				<a href={`/o/${data.organization.slug}/checkouts`} class="link link-primary text-sm">View all</a>
			</div>
			<div class="card bg-base-100 shadow">
				<div class="overflow-x-auto">
					<table class="table">
						<tbody>
							{#each data.checkouts.slice(0, 5) as c (c.id)}
								<tr class="hover">
									<td>
										<a
											href={`/o/${data.organization.slug}/${c.record.objectType.slug}/${c.recordId}`}
											class="link link-hover"
										>
											{c.record.data.values.name ?? c.record.objectType.name}
										</a>
									</td>
									<td>{holderName(c)}</td>
									<td class={isOverdue(c.dueAt) ? 'text-error font-medium' : 'text-base-content/60'}>
										{formatDate(c.dueAt)}
									</td>
								</tr>
							{:else}
								<tr><td class="text-base-content/60">Nothing is currently checked out.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="flex items-center gap-2 font-medium"><Activity size={16} /> Recent activity</h2>
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<ul class="space-y-3">
						{#each data.activity as entry (entry.id)}
							<li class="flex justify-between gap-4 text-sm">
								<span>
									<span class="font-medium">{ACTIVITY_LABELS[entry.action] ?? entry.action}</span>
									{#if entry.record}
										<a
											href={`/o/${data.organization.slug}/${entry.record.objectType.slug}/${entry.recordId}`}
											class="link link-hover"
										>
											{entry.record.objectType.name}
										</a>
									{/if}
									{#if entry.actor}
										<span class="text-base-content/60"> by {entry.actor.name}</span>
									{/if}
								</span>
								<span class="text-base-content/50 shrink-0">{formatDate(entry.createdAt)}</span>
							</li>
						{:else}
							<li class="text-base-content/60 text-sm">No activity yet.</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>
	</div>
	{/if}
</div>
{/if}
