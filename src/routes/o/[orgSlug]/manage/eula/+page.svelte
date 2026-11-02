<script lang="ts">
	import { enhance } from '$app/forms';
	import { Save } from '@lucide/svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let submittingId = $state<string | null>(null);
</script>

<div class="mx-auto max-w-4xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<h1 class="text-lg font-semibold">EULA</h1>
		<p class="text-base-content/60 text-sm">
			Define an agreement per object type. When enabled, checking an item out to a person offers
			the option to require them to read it and type their full name to confirm receipt, instead
			of a plain one-click confirmation.
		</p>
	</div>

	<div class="join join-vertical w-full">
		{#each data.objectTypes as t (t.id)}
			<div class="collapse-arrow border-base-300 join-item collapse border">
				<input type="radio" name="eula-accordion" />
				<div class="collapse-title flex items-center gap-2 font-medium">
					{t.name}
					{#if t.eulaEnabled}
						<span class="badge badge-success badge-sm font-normal">Required</span>
					{/if}
				</div>
				<div class="collapse-content">
					<form
						method="post"
						action="?/save"
						use:enhance={() => {
							submittingId = t.id;
							return async ({ update }) => {
								await update();
								submittingId = null;
							};
						}}
						class="space-y-3"
					>
						<input type="hidden" name="objectTypeId" value={t.id} />
						<label class="label cursor-pointer justify-start gap-2">
							<input type="checkbox" name="eulaEnabled" class="checkbox checkbox-sm" checked={t.eulaEnabled} />
							<span class="label-text">Require EULA acceptance when checked out to a person</span>
						</label>
						{#key t.eulaText}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Agreement text</legend>
								<RichTextEditor name="eulaText" value={t.eulaText ?? ''} />
							</fieldset>
						{/key}

						{#if form?.objectTypeId === t.id && form?.message}
							<div class="alert alert-error text-sm"><span>{form.message}</span></div>
						{/if}
						{#if form?.objectTypeId === t.id && form?.success}
							<div class="alert alert-success text-sm"><span>Saved.</span></div>
						{/if}

						<div class="flex justify-end pt-1">
							<button type="submit" class="btn btn-primary btn-sm" disabled={submittingId === t.id}>
								{#if submittingId === t.id}
									<span class="loading loading-spinner loading-xs"></span>
									Saving...
								{:else}
									<Save size={13} />
									Save
								{/if}
							</button>
						</div>
					</form>
				</div>
			</div>
		{:else}
			<p class="text-base-content/60 text-sm">No object types yet.</p>
		{/each}
	</div>
</div>
