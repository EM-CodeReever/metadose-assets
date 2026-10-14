<!--
  metadose Auth Shell (SvelteKit)
  ─────────────────────────────────────────────────────────────────
  A reusable, split-screen "premium SaaS" auth page layout, shared across every app in the
  metadose suite: a branded hero panel (logo, tagline, feature highlights) beside the actual
  auth form, which each app supplies as children. Colors are drawn entirely from daisyUI's
  active theme (primary/primary-content), so the hero reskins automatically with whichever
  theme the person (or the app) has chosen — nothing here is a fixed brand hex.

  Usage:
    <AuthShell
      appSuffix="assets"
      tagline="Know where everything is, always."
      description="Track assets, accessories and consumables across every team — who has what,
        where it's been, and what's due back."
      features={[
        { icon: Boxes, text: 'Assets, accessories, consumables & your own custom types' },
        { icon: ClipboardList, text: 'Request / approve checkouts instead of spreadsheets' },
        { icon: ScrollText, text: 'A full, filterable activity log for every organization' }
      ]}
    >
      {#snippet topRight()}<ThemeSwitcher />{/snippet}
      (the actual sign-in / forgot-password / etc. card markup goes here)
    </AuthShell>

  Props:
    appSuffix     string | null                          default: 'assets' — passed straight
                                                           through to <Logo suffix>.
    tagline       string                        (required) — the big hero headline.
    description   string                                  — optional supporting sentence(s).
    features      { icon: Component, text: string }[]     — optional highlight list.
    topRight      Snippet                                 — rendered top-right of the form
                                                             panel (e.g. a theme switcher).
    children      Snippet                       (required) — the form panel's content.
  ─────────────────────────────────────────────────────────────────
-->
<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import Logo from './Logo.svelte';

	let {
		appSuffix = 'assets',
		tagline,
		description,
		features = [],
		topRight,
		children
	}: {
		appSuffix?: string | null;
		tagline: string;
		description?: string;
		features?: { icon: Component; text: string }[];
		topRight?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="bg-base-200 flex min-h-screen">
	<!-- Hero panel. Hidden below lg — there's no room for a second panel once the form itself
	     needs the full width, and the form is the only part that must always be reachable. -->
	<div class="from-primary to-primary/70 relative hidden overflow-hidden bg-gradient-to-br lg:flex lg:w-1/2 xl:w-[45%]">
		<!-- Decorative echo of the icon mark's layered-squares motif, faded into the corner. -->
		<svg
			class="text-primary-content pointer-events-none absolute -top-16 -right-16 opacity-[0.07]"
			width="380"
			height="380"
			viewBox="0 0 36 36"
			fill="none"
			aria-hidden="true"
		>
			<rect x="0" y="10" width="24" height="24" rx="6" fill="currentColor" />
			<rect x="4" y="6" width="24" height="24" rx="6" fill="currentColor" />
			<rect x="8" y="2" width="24" height="24" rx="6" fill="currentColor" />
		</svg>

		<div class="relative z-10 flex w-full flex-col justify-between p-12">
			<Logo variant="on-primary" width={200} suffix={appSuffix} />

			<div class="max-w-md space-y-6">
				<h1 class="text-primary-content text-4xl font-bold text-balance">{tagline}</h1>
				{#if description}
					<p class="text-primary-content/80 text-base">{description}</p>
				{/if}
				{#if features.length > 0}
					<ul class="space-y-3 pt-2">
						{#each features as f, i (i)}
							<li class="text-primary-content flex items-center gap-3">
								<span class="bg-primary-content/15 flex size-8 shrink-0 items-center justify-center rounded-full">
									<f.icon size={16} />
								</span>
								<span class="text-sm">{f.text}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<p class="text-primary-content/50 text-xs">Part of the metadose suite</p>
		</div>
	</div>

	<!-- Form panel -->
	<div class="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
		{#if topRight}
			<div class="absolute top-4 right-4">{@render topRight()}</div>
		{/if}

		<!-- Shown only when the hero panel is hidden (below lg), so the brand is still present. -->
		<div class="mb-6 lg:hidden">
			<Logo width={170} suffix={appSuffix} />
		</div>

		{@render children()}
	</div>
</div>
