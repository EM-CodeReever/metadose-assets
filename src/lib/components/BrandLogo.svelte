<script lang="ts">
	import Logo from '$lib/brand/components/Logo.svelte';

	let { width = 190 }: { width?: number } = $props();
</script>

<a href="/" aria-label="metadose-assets home" class="inline-flex w-full items-center justify-center">
	<Logo {width} />
</a>
