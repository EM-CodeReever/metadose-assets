<script lang="ts">
	import { ArrowLeft, Printer } from '@lucide/svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	interface LabelLine {
		label: string;
		value: string;
	}

	const labelLines = $derived.by((): LabelLine[] => {
		const keys = data.objectType.barcodeFieldKeys ?? [];
		const lines = keys
			.map((key) => {
				const field = data.objectType.fields.find((f) => f.key === key);
				const value = data.record.data.values[key];
				if (!field || value === undefined || value === null || value === '') return null;
				return { label: field.label, value: String(value) };
			})
			.filter((l): l is LabelLine => l !== null);

		if (lines.length > 0) return lines;
		return [{ label: 'Name', value: String(data.record.data.values.name ?? data.record.id) }];
	});

	// The barcode always encodes the record's own unique id — unlike a configured field, it's
	// guaranteed present and unique for every record, so a scan always resolves to exactly one
	// item (see recordLookup.ts, which checks a scanned value against record ids first). The QR
	// code separately encodes a link to the item's page.
	const barcodeData = $derived(data.record.id);

	let showQr = $state(true);
	let showBarcode = $state(true);
	let showText = $state(true);

	let qrCanvas: HTMLCanvasElement | undefined = $state();
	let barcodeSvg: SVGSVGElement | undefined = $state();
	let barcodeError = $state('');

	$effect(() => {
		if (!showQr || !qrCanvas) return;
		const pageUrl = `${location.origin}/o/${data.organization.slug}/${data.objectType.slug}/${data.record.id}`;
		import('qrcode').then((QRCode) => {
			if (qrCanvas) QRCode.toCanvas(qrCanvas, pageUrl, { width: 160, margin: 1 }).catch(() => {});
		});
	});

	$effect(() => {
		if (!showBarcode || !barcodeSvg) return;
		barcodeError = '';
		import('jsbarcode').then(({ default: JsBarcode }) => {
			if (!barcodeSvg) return;
			try {
				JsBarcode(barcodeSvg, barcodeData, {
					format: 'CODE128',
					displayValue: false,
					width: 2,
					height: 60,
					margin: 4
				});
			} catch {
				barcodeError = "This value can't be encoded as a barcode";
			}
		});
	});
</script>

<svelte:head>
	<title>Label — {labelLines[0]?.value}</title>
</svelte:head>

<div class="bg-base-200 flex min-h-screen flex-col items-center gap-6 p-6 print:bg-white print:p-0">
	<div class="flex w-full max-w-sm items-center justify-between print:hidden">
		<a
			href={`/o/${data.organization.slug}/${data.objectType.slug}/${data.record.id}`}
			class="link link-primary flex items-center gap-1 text-sm"
		>
			<ArrowLeft size={14} />
			Back
		</a>
		<button type="button" class="btn btn-primary btn-sm" onclick={() => window.print()}>
			<Printer size={14} />
			Print
		</button>
	</div>

	<div class="w-full max-w-sm space-y-3 rounded-box print:hidden">
		<label class="label cursor-pointer justify-start gap-2">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={showQr} />
			<span class="label-text">QR code (links to this item's page)</span>
		</label>
		<label class="label cursor-pointer justify-start gap-2">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={showBarcode} />
			<span class="label-text">Barcode (encodes this item's id: "{barcodeData}")</span>
		</label>
		<label class="label cursor-pointer justify-start gap-2">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={showText} />
			<span class="label-text">Show text on label</span>
		</label>
	</div>

	<div class="card bg-base-100 w-fit shadow print:shadow-none print:border print:border-black">
		<div class="card-body items-center gap-2 p-6 text-center">
			{#if showQr}
				<canvas bind:this={qrCanvas}></canvas>
			{/if}
			{#if showBarcode}
				<svg bind:this={barcodeSvg}></svg>
				{#if barcodeError}
					<p class="text-error text-xs">{barcodeError}</p>
				{/if}
			{/if}
			{#if showText}
				<div class="mt-1 space-y-0.5">
					{#each labelLines as line (line.label)}
						<p class="font-mono text-sm font-semibold break-all">
							<span class="text-base-content/50 font-sans font-normal">{line.label}:</span>
							{line.value}
						</p>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	@media print {
		:global(html),
		:global(body) {
			background: white;
		}
	}
</style>
