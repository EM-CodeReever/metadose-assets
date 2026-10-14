<script lang="ts">
	import { untrack } from 'svelte';
	import { Plus } from '@lucide/svelte';

	interface Option {
		id: string;
		name: string;
	}

	let {
		name,
		orgSlug,
		options,
		value,
		required = false
	}: {
		name: string;
		orgSlug: string;
		options: Option[];
		value?: unknown;
		required?: boolean;
	} = $props();

	let localOptions = $state<Option[]>(untrack(() => [...options]));
	let selectedId = $state<string>(untrack(() => (value ? String(value) : '')));
	let search = $state(untrack(() => localOptions.find((o) => o.id === selectedId)?.name ?? ''));
	let open = $state(false);
	let error = $state('');
	let adding = $state(false);

	const filtered = $derived(
		search.trim()
			? localOptions.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()))
			: localOptions
	);
	const exactMatch = $derived(localOptions.some((o) => o.name.toLowerCase() === search.trim().toLowerCase()));

	function selectOption(opt: Option) {
		selectedId = opt.id;
		search = opt.name;
		open = false;
		error = '';
	}

	function onInput(text: string) {
		search = text;
		open = true;
		error = '';
		const match = localOptions.find((o) => o.name.toLowerCase() === text.trim().toLowerCase());
		selectedId = match ? match.id : '';
	}

	async function addNew() {
		const trimmed = search.trim();
		if (!trimmed || adding) return;
		adding = true;
		error = '';
		try {
			const response = await fetch(`/o/${orgSlug}/api/locations`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: trimmed })
			});
			const body = await response.json();
			if (!response.ok) {
				error = body.message ?? 'Could not add location';
				return;
			}
			localOptions = [...localOptions, body.created];
			selectOption(body.created);
		} catch {
			error = 'Could not add location';
		} finally {
			adding = false;
		}
	}
</script>

<div class="relative">
	<input type="hidden" {name} value={selectedId} {required} />
	<input
		type="text"
		class="input w-full"
		value={search}
		placeholder="Search or add a location..."
		autocomplete="off"
		oninput={(e) => onInput(e.currentTarget.value)}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 150)}
	/>
	{#if open}
		<ul class="menu bg-base-100 rounded-box absolute z-10 mt-1 w-full flex-nowrap gap-0.5 shadow-lg max-h-60 overflow-y-auto">
			{#each filtered as opt (opt.id)}
				<li>
					<button type="button" onmousedown={(e) => e.preventDefault()} onclick={() => selectOption(opt)}>
						{opt.name}
					</button>
				</li>
			{/each}
			{#if search.trim() && !exactMatch}
				<li>
					<button
						type="button"
						class="text-primary"
						onmousedown={(e) => e.preventDefault()}
						onclick={addNew}
						disabled={adding}
					>
						<Plus size={14} />
						Add "{search.trim()}"
					</button>
				</li>
			{/if}
			{#if filtered.length === 0 && !search.trim()}
				<li class="text-base-content/50 px-3 py-2 text-sm">No locations yet — start typing to add one.</li>
			{/if}
		</ul>
	{/if}
	{#if error}
		<p class="text-error mt-1 text-xs">{error}</p>
	{/if}
</div>
