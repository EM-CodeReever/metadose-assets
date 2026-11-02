<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import 'quill/dist/quill.snow.css';

	let {
		name,
		value = ''
	}: {
		/** The hidden field's name — posted as the editor's saved HTML on form submit. */
		name: string;
		value?: string;
	} = $props();

	let editorEl: HTMLDivElement;
	// Seeds the editor once at mount — deliberately not reactive to later `value` prop changes,
	// since from then on the editor's own content (via text-change below) is the source of truth.
	let html = $state(untrack(() => value));

	onMount(() => {
		let destroyed = false;
		let quill: import('quill').default;

		import('quill').then(({ default: Quill }) => {
			if (destroyed) return;
			quill = new Quill(editorEl, {
				theme: 'snow',
				modules: {
					toolbar: [
						[{ header: [1, 2, 3, false] }],
						['bold', 'italic', 'underline'],
						[{ list: 'ordered' }, { list: 'bullet' }],
						['blockquote'],
						['clean']
					]
				}
			});
			quill.root.innerHTML = value;
			quill.on('text-change', () => {
				html = quill.root.innerHTML;
			});
		});

		return () => {
			destroyed = true;
		};
	});
</script>

<div class="bg-base-100 rounded-box border">
	<div bind:this={editorEl} class="min-h-40"></div>
</div>
<input type="hidden" {name} value={html} />

<style>
	:global(.ql-toolbar.ql-snow) {
		border: none;
		border-bottom: 1px solid var(--color-base-300, #e5e7eb);
	}
	:global(.ql-container.ql-snow) {
		border: none;
		font-size: inherit;
	}
</style>
