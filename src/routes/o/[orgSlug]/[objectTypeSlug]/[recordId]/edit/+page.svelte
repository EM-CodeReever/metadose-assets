<script lang="ts">
	import { enhance } from '$app/forms';
	import RecordFieldInput from '$lib/components/RecordFieldInput.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const editableFields = $derived(data.objectType.fields.filter((f) => !f.systemManaged));

	function currentValue(key: string): unknown {
		return form?.values?.[key] ?? data.record.data.values[key];
	}
</script>

<div class="max-w-4xl space-y-6">
	<div>
		<a
			href={`/o/${data.organization.slug}/${data.objectType.slug}/${data.record.id}`}
			class="link link-primary text-sm"
		>
			&larr; Back
		</a>
		<h1 class="text-lg font-semibold">Edit {data.objectType.name} record</h1>
	</div>

	{#if form?.message}
		<div class="alert alert-error text-sm">
			<span>{form.message}</span>
		</div>
	{/if}

	<form method="post" use:enhance class="card bg-base-100 shadow">
		<div class="card-body">
			<div class="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
				{#each editableFields as field (field.id)}
					<RecordFieldInput
							{field}
							value={currentValue(field.key)}
							orgUsers={data.orgUsers}
							lookupValues={data.lookupValues}
							orgSlug={data.organization.slug}
							min={field.key === 'minQuantity' ? 1 : undefined}
						/>
				{/each}
			</div>
			<div class="mt-4">
				<button type="submit" class="btn btn-primary">Save changes</button>
			</div>
		</div>
	</form>
</div>
