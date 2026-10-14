<script lang="ts">
	import ReferenceFieldSelect from './ReferenceFieldSelect.svelte';

	interface FieldLike {
		key: string;
		label: string;
		dataType: string;
		required: boolean;
		selectOptions?: { value: string; label: string }[] | null;
		referenceKind?: string | null;
	}

	interface OrgUser {
		id: string;
		name: string;
	}

	interface LookupOption {
		id: string;
		name: string;
	}

	let {
		field,
		value,
		orgUsers = [],
		lookupValues = {},
		orgSlug,
		min,
		onchange
	}: {
		field: FieldLike;
		value: unknown;
		orgUsers?: OrgUser[];
		lookupValues?: Record<string, LookupOption[]>;
		orgSlug?: string;
		min?: number;
		onchange?: (value: string) => void;
	} = $props();
</script>

<fieldset class="fieldset">
	<legend class="fieldset-legend">
		{field.label}{#if field.required}<span class="text-error"> *</span>{/if}
	</legend>

	{#if field.dataType === 'number'}
		<input
			type="number"
			step="any"
			{min}
			name={field.key}
			required={field.required}
			value={value ?? ''}
			class="input w-full"
			onchange={(e) => onchange?.(e.currentTarget.value)}
		/>
	{:else if field.dataType === 'date'}
		<input
			type="date"
			name={field.key}
			required={field.required}
			value={value ?? ''}
			class="input w-full"
		/>
	{:else if field.dataType === 'boolean'}
		<input type="checkbox" name={field.key} class="checkbox" checked={!!value} />
	{:else if field.dataType === 'select'}
		<select
			name={field.key}
			required={field.required}
			class="select w-full"
			onchange={(e) => onchange?.(e.currentTarget.value)}
		>
			<option value="" disabled selected={!value}>Select...</option>
			{#each field.selectOptions ?? [] as opt (opt.value)}
				<option value={opt.value} selected={value === opt.value}>{opt.label}</option>
			{/each}
		</select>
	{:else if field.dataType === 'user_reference'}
		<select name={field.key} required={field.required} class="select w-full">
			<option value="" disabled selected={!value}>Select a user...</option>
			{#each orgUsers as u (u.id)}
				<option value={u.id} selected={value === u.id}>{u.name}</option>
			{/each}
		</select>
	{:else if field.dataType === 'reference' && orgSlug}
		<ReferenceFieldSelect
			name={field.key}
			{orgSlug}
			kind={field.referenceKind ?? ''}
			options={lookupValues[field.referenceKind ?? ''] ?? []}
			{value}
		/>
	{:else}
		<input name={field.key} required={field.required} value={value ?? ''} class="input w-full" />
	{/if}
</fieldset>
