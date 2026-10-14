<script lang="ts">
	import LookupValueManager from '$lib/components/LookupValueManager.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<LookupValueManager
	title="Categories"
	description="Groupings like Laptop, Desktop, Toner, or Mouse — spans assets and consumables alike."
	values={data.values}
	{form}
/>
