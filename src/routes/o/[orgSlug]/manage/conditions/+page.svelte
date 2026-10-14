<script lang="ts">
	import LookupValueManager from '$lib/components/LookupValueManager.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<LookupValueManager
	title="Conditions"
	description="Physical/functional condition of assets, accessories, and components."
	values={data.values}
	{form}
	showOutOfService
/>
