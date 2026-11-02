<script lang="ts">
	import { enhance } from '$app/forms';
	import { Eye, RotateCcw, Save } from '@lucide/svelte';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let submittingKey = $state<string | null>(null);
	let previewOpen = $state<Set<string>>(new Set());

	function togglePreview(key: string) {
		const next = new Set(previewOpen);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		previewOpen = next;
	}

	/** Same simple `{{var}}` substitution as the server's `renderTemplate`, just for showing a
	 *  preview client-side without a round trip. */
	function withSamples(html: string, samples: Record<string, string>): string {
		return html.replace(/\{\{(\w+)\}\}/g, (match, name) => samples[name] ?? match);
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 2xl:max-w-[1600px]">
	<div>
		<a href="/admin/settings" class="link link-primary text-sm">&larr; Settings</a>
		<h1 class="text-lg font-semibold">Email templates</h1>
		<p class="text-base-content/60 text-sm">
			Every email the app sends — edit the subject/body, or reset one back to its default.
			Variables in <code class="text-xs">&#123;&#123;like this&#125;&#125;</code> get filled in when it's actually sent.
		</p>
	</div>

	<div class="join join-vertical w-full">
		{#each data.templates as t (t.key)}
			<div class="collapse-arrow border-base-300 join-item collapse border">
				<input type="radio" name="email-template-accordion" />
				<div class="collapse-title flex items-center gap-2 font-medium">
					{t.label}
					{#if t.isCustomized}
						<span class="badge badge-info badge-sm font-normal">Customized</span>
					{/if}
				</div>
				<div class="collapse-content">
					<p class="text-base-content/60 mb-3 text-sm">{t.description}</p>
					<p class="text-base-content/50 mb-3 text-xs">
						Available variables:
						{#each t.variables as v, i (v)}
							<code class="text-xs">{`{{${v}}}`}</code>{i < t.variables.length - 1 ? ', ' : ''}
						{/each}
					</p>

					<form
						method="post"
						action="?/save"
						use:enhance={() => {
							submittingKey = t.key;
							return async ({ update }) => {
								await update();
								submittingKey = null;
							};
						}}
						class="space-y-3"
					>
						<input type="hidden" name="key" value={t.key} />
						{#key t.subject}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Subject</legend>
								<input name="subject" value={t.subject} class="input w-full" />
							</fieldset>
						{/key}
						{#key t.html}
							<fieldset class="fieldset">
								<legend class="fieldset-legend">Body (HTML)</legend>
								<textarea name="html" rows="6" class="textarea w-full font-mono text-xs">{t.html}</textarea>
							</fieldset>
						{/key}

						{#if form?.key === t.key && form?.message}
							<div class="alert alert-error text-sm"><span>{form.message}</span></div>
						{/if}
						{#if form?.key === t.key && form?.success && !form?.wasReset}
							<div class="alert alert-success text-sm"><span>Saved.</span></div>
						{/if}
						{#if form?.key === t.key && form?.success && form?.wasReset}
							<div class="alert alert-success text-sm"><span>Reset to default.</span></div>
						{/if}

						<div class="flex flex-wrap items-center justify-between gap-2 pt-1">
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => togglePreview(t.key)}>
								<Eye size={14} />
								{previewOpen.has(t.key) ? 'Hide preview' : 'Preview'}
							</button>
							<div class="flex gap-2">
								{#if t.isCustomized}
									<button
										type="submit"
										formaction="?/reset"
										class="btn btn-outline btn-sm"
										disabled={submittingKey === t.key}
									>
										<RotateCcw size={13} />
										Reset to default
									</button>
								{/if}
								<button type="submit" class="btn btn-primary btn-sm" disabled={submittingKey === t.key}>
									{#if submittingKey === t.key}
										<span class="loading loading-spinner loading-xs"></span>
										Saving...
									{:else}
										<Save size={13} />
										Save
									{/if}
								</button>
							</div>
						</div>
					</form>

					{#if previewOpen.has(t.key)}
						<div class="border-base-300 bg-base-200 mt-3 rounded-lg border p-4">
							<p class="text-base-content/50 mb-2 text-xs">
								Subject: <strong>{withSamples(t.subject, t.sampleValues)}</strong>
							</p>
							<div class="bg-base-100 rounded border p-3 text-sm">
								{@html withSamples(t.html, t.sampleValues)}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
