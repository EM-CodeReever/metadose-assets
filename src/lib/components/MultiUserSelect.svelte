<script lang="ts">
	import { X } from '@lucide/svelte';

	interface Option {
		id: string;
		name: string;
		email: string;
	}

	let {
		name,
		options
	}: {
		/** The hidden field's name — posted as a JSON array of selected ids, same convention as
		 *  the other bulk-selection flows (bulk ban/delete, LDAP sync) in this app. */
		name: string;
		options: Option[];
	} = $props();

	let selected = $state<Set<string>>(new Set());
	let search = $state('');
	let open = $state(false);

	const filtered = $derived(
		search.trim()
			? options.filter(
					(o) =>
						o.name.toLowerCase().includes(search.trim().toLowerCase()) ||
						o.email.toLowerCase().includes(search.trim().toLowerCase())
				)
			: options
	);
	const selectedOptions = $derived(options.filter((o) => selected.has(o.id)));
	const valueJson = $derived(JSON.stringify([...selected]));

	function toggle(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function remove(id: string) {
		const next = new Set(selected);
		next.delete(id);
		selected = next;
	}
</script>

<div class="relative">
	<input type="hidden" {name} value={valueJson} />
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="input h-auto min-h-10 w-full flex-wrap items-center gap-1 py-1.5"
		onclick={() => (open = true)}
	>
		{#each selectedOptions as opt (opt.id)}
			<span class="badge badge-primary gap-1 font-normal">
				{opt.name}
				<button
					type="button"
					aria-label="Remove {opt.name}"
					onmousedown={(e) => e.preventDefault()}
					onclick={(e) => {
						e.stopPropagation();
						remove(opt.id);
					}}
				>
					<X size={12} />
				</button>
			</span>
		{/each}
		<input
			type="text"
			class="min-w-32 flex-1 bg-transparent outline-none"
			placeholder={selectedOptions.length === 0 ? 'Search people...' : ''}
			bind:value={search}
			autocomplete="off"
			onfocus={() => (open = true)}
			onblur={() => setTimeout(() => (open = false), 150)}
		/>
	</div>
	{#if open}
		<ul class="menu bg-base-100 rounded-box absolute z-10 mt-1 max-h-60 w-full flex-nowrap gap-0.5 overflow-y-auto shadow-lg">
			{#each filtered as opt (opt.id)}
				<li>
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<label class="flex items-center gap-2" onmousedown={(e) => e.preventDefault()}>
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							checked={selected.has(opt.id)}
							onchange={() => toggle(opt.id)}
						/>
						<span class="truncate">{opt.name}</span>
						<span class="text-base-content/50 truncate text-xs">{opt.email}</span>
					</label>
				</li>
			{:else}
				<li class="text-base-content/50 px-3 py-2 text-sm">No one matches "{search.trim()}".</li>
			{/each}
		</ul>
	{/if}
</div>
