<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Camera, ScanLine, Search } from '@lucide/svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let codeInput: HTMLInputElement | undefined = $state();
	let form: HTMLFormElement | undefined = $state();
	let video: HTMLVideoElement | undefined = $state();
	let stream: MediaStream | null = null;
	let scanning = $state(false);
	let cameraError = $state('');
	let cameraSupported = $state(true);

	$effect(() => {
		// BarcodeDetector is Chrome/Edge/Android-only today; feature-detect rather than assume.
		cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
		codeInput?.focus();
	});

	async function startCamera() {
		cameraError = '';
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
			if (video) video.srcObject = stream;
			scanning = true;
			runDetectionLoop();
		} catch {
			cameraError = "Couldn't access the camera. Check your browser's camera permission.";
		}
	}

	function stopCamera() {
		scanning = false;
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
	}

	async function runDetectionLoop() {
		// @ts-expect-error BarcodeDetector isn't in lib.dom.d.ts yet.
		const detector = new window.BarcodeDetector({
			formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
		});

		while (scanning && video) {
			try {
				const codes = await detector.detect(video);
				if (codes.length > 0) {
					const value: string = codes[0].rawValue;
					stopCamera();
					if (codeInput) codeInput.value = value;
					form?.requestSubmit();
					return;
				}
			} catch {
				// A frame occasionally isn't decodable yet (video still starting) — keep looping.
			}
			await new Promise((r) => setTimeout(r, 200));
		}
	}

	onDestroy(stopCamera);
</script>

<div class="flex min-h-[65vh] flex-col items-center justify-center gap-6 text-center">
	<div>
		<ScanLine size={56} class="text-primary mx-auto mb-3" />
		<h1 class="text-2xl font-semibold">Scan to look up</h1>
		<p class="text-base-content/60 mt-1 text-sm">
			Scan a label with a barcode scanner, or type the code and press Enter.
		</p>
	</div>

	<form bind:this={form} method="get" class="flex w-full max-w-xl gap-2">
		<label class="input flex-1">
			<Search size={16} class="opacity-50" />
			<input
				bind:this={codeInput}
				type="text"
				name="code"
				value={data.code}
				placeholder="Scan or type a code..."
				autocomplete="off"
			/>
		</label>
		<button type="submit" class="btn btn-primary">Look up</button>
	</form>

	{#if cameraSupported}
		<div class="flex flex-col items-center">
			{#if !scanning}
				<button type="button" class="btn btn-outline btn-sm" onclick={startCamera}>
					<Camera size={16} />
					Use camera instead
				</button>
			{:else}
				<button type="button" class="btn btn-outline btn-sm" onclick={stopCamera}>Stop camera</button>
			{/if}
			{#if cameraError}
				<p class="text-error mt-2 text-sm">{cameraError}</p>
			{/if}
			{#if scanning}
				<div class="relative mt-3 w-full max-w-sm overflow-hidden rounded-box">
					<video bind:this={video} autoplay muted playsinline class="w-full"></video>
					<ScanLine class="text-primary/70 absolute inset-x-0 top-1/2 w-full -translate-y-1/2" size={24} />
				</div>
			{/if}
		</div>
	{/if}

	{#if data.code && data.matches.length === 0}
		<div class="alert alert-warning w-full max-w-xl text-left text-sm">
			<span>No record found matching "{data.code}".</span>
		</div>
	{/if}

	{#if data.matches.length > 1}
		<div class="w-full max-w-xl space-y-2 text-left">
			<p class="text-sm font-medium">Multiple records matched "{data.code}":</p>
			<div class="card bg-base-100 shadow">
				<ul class="divide-base-300 divide-y">
					{#each data.matches as m (m.recordId)}
						<li>
							<a
								href={`/o/${data.organization.slug}/${m.objectTypeSlug}/${m.recordId}`}
								class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-base-200"
							>
								<span class="font-medium">{m.recordName}</span>
								<span class="text-base-content/50 text-sm">{m.objectTypeName} · {m.matchedField}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
</div>
