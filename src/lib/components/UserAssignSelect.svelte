<script lang="ts">
	import { untrack } from 'svelte';
	import { orgRoleIcon } from '$lib/badgeStyles';

	interface Option {
		id: string;
		name: string;
		email: string;
		orgRole: string;
	}

	let {
		name,
		options,
		value,
		required = false
	}: {
		name: string;
		options: Option[];
		value?: unknown;
		required?: boolean;
	} = $props();

	let selectedId = $state<string>(untrack(() => (value ? String(value) : '')));
	let search = $state(untrack(() => options.find((o) => o.id === selectedId)?.name ?? ''));
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

	function selectOption(opt: Option) {
		selectedId = opt.id;
		search = opt.name;
		open = false;
	}

	function onInput(text: string) {
		search = text;
		open = true;
		const match = options.find((o) => o.name.toLowerCase() === text.trim().toLowerCase());
		selectedId = match ? match.id : '';
	}
</script>

<div class="relative">
	<input type="hidden" {name} value={selectedId} {required} />
	<input
		type="text"
		class="input w-full"
		value={search}
		placeholder="Search people..."
		autocomplete="off"
		oninput={(e) => onInput(e.currentTarget.value)}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 150)}
	/>
	{#if open}
		<ul class="menu bg-base-100 rounded-box absolute z-10 mt-1 w-full flex-nowrap gap-0.5 shadow-lg max-h-60 overflow-y-auto">
			{#each filtered as opt (opt.id)}
				{@const RoleIcon = orgRoleIcon(opt.orgRole)}
				<li>
					<button type="button" onmousedown={(e) => e.preventDefault()} onclick={() => selectOption(opt)}>
						<span
							class="tooltip tooltip-right flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-base-200"
							data-tip={opt.orgRole}
						>
							<RoleIcon size={11} />
						</span>
						<span class="truncate">{opt.name}</span>
						<span class="text-base-content/50 truncate text-xs">{opt.email}</span>
					</button>
				</li>
			{:else}
				<li class="text-base-content/50 px-3 py-2 text-sm">No one matches "{search.trim()}".</li>
			{/each}
		</ul>
	{/if}
</div>
