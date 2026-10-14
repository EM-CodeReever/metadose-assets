<script lang="ts">
	import LookupValueManager from '$lib/components/LookupValueManager.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<LookupValueManager
	title="Manufacturers"
	description="Makers of assets, accessories, consumables, and components."
	values={data.values}
	{form}
/>
