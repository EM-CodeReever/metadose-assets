<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	let {
		page = $bindable(1),
		totalItems,
		pageSize = 25
	}: {
		page?: number;
		totalItems: number;
		pageSize?: number;
	} = $props();

	const totalPages = $derived(Math.max(Math.ceil(totalItems / pageSize), 1));
	const rangeStart = $derived(totalItems === 0 ? 0 : (page - 1) * pageSize + 1);
	const rangeEnd = $derived(Math.min(page * pageSize, totalItems));
</script>

{#if totalItems > pageSize}
	<div class="flex items-center justify-between gap-3 pt-1">
		<span class="text-base-content/50 text-xs">{rangeStart}–{rangeEnd} of {totalItems}</span>
		<div class="join">
			<button type="button" class="btn btn-sm join-item" disabled={page <= 1} onclick={() => (page = page - 1)}>
				<ChevronLeft size={14} />
			</button>
			<span class="btn btn-sm join-item btn-disabled">Page {page} of {totalPages}</span>
			<button
				type="button"
				class="btn btn-sm join-item"
				disabled={page >= totalPages}
				onclick={() => (page = page + 1)}
			>
				<ChevronRight size={14} />
			</button>
		</div>
	</div>
{/if}
