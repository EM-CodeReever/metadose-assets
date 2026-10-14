<!--
  metadose-assets Logo Component (SvelteKit)
  ─────────────────────────────────────────────────────────────────
  Usage:
    <Logo />                     — horizontal, auto theme
    <Logo variant="dark" />      — force dark wordmark
    <Logo variant="light" />     — force light wordmark
    <Logo variant="white" />      — all-white (for accent backgrounds with no live theme,
                                    e.g. print/email exports)
    <Logo variant="on-primary" /> — theme-aware reverse, for a panel painted in the active
                                    theme's own primary color (e.g. a gradient hero) — tracks
                                    --color-primary-content the same way the panel's own text does,
                                    instead of a fixed white that can clash with some themes
    <Logo iconOnly />            — icon mark only
    <Logo width={140} />         — custom width (height scales)

  Props:
    variant   'auto' | 'light' | 'dark' | 'white' | 'on-primary'   default: 'auto'
    iconOnly  boolean                                 default: false
    width     number (px)                             default: 160
    suffix    string | null                            default: 'assets' — the app this
                                                        lockup names within the metadose suite
                                                        ('assets', 'monitor', ...); null/'' omits
                                                        the second line and renders just 'metadose'.
    class     string                                  — forwarded to root element
  ─────────────────────────────────────────────────────────────────
-->
<script lang="ts">
  let {
    variant = 'auto',
    iconOnly = false,
    width,
    suffix = 'assets',
    class: className = ''
  }: {
    variant?: 'auto' | 'light' | 'dark' | 'white' | 'on-primary';
    iconOnly?: boolean;
    width?: number;
    suffix?: string | null;
    class?: string;
  } = $props();

  const fullName = $derived(suffix ? `metadose-${suffix}` : 'metadose');

  const resolvedWidth = $derived(width ?? (iconOnly ? 36 : 160));

  // Colour sets per variant. 'auto' tracks whichever daisyUI theme is active (including
  // text colour) via daisyUI's own --color-* variables, instead of a fixed light/dark
  // palette — this app lets people pick between many very different themes (light, dark,
  // night, coffee, aqua, nord, ...), so a logo hardcoded to light/dark would look wrong in
  // most of them. The explicit light/dark/white variants stay fixed-colour on purpose, for
  // contexts with no live theme to track (print exports, emails, marketing).
  const colours = {
    auto: {
      back:   'color-mix(in oklch, var(--color-primary) 25%, transparent)',
      mid:    'color-mix(in oklch, var(--color-primary) 55%, transparent)',
      front:  'var(--color-primary)',
      mark:   'var(--color-base-content)',
      suffix: 'var(--color-primary)',
      lines:  'var(--color-primary-content)',
    },
    light: {
      back:   '#D1DEFF',
      mid:    '#8EB4FF',
      front:  '#1E6BFF',
      mark:   '#0D1117',
      suffix: '#1E6BFF',
      lines:  'white',
    },
    dark: {
      back:   '#1A2845',
      mid:    '#2952A3',
      front:  '#3D84FF',
      mark:   '#E8ECF4',
      suffix: '#3D84FF',
      lines:  'white',
    },
    white: {
      back:   'rgba(255,255,255,0.15)',
      mid:    'rgba(255,255,255,0.30)',
      front:  'rgba(255,255,255,0.95)',
      mark:   'white',
      suffix: 'rgba(255,255,255,0.75)',
      lines:  '#1E6BFF',
    },
    // Same reversed-colour layout as 'white', but every value is theme-driven — for a panel
    // that's painted in the active theme's own primary color, so the mark keeps working
    // (and matches) regardless of which theme's primary happens to be active.
    'on-primary': {
      back:   'color-mix(in oklch, var(--color-primary-content) 15%, transparent)',
      mid:    'color-mix(in oklch, var(--color-primary-content) 30%, transparent)',
      front:  'color-mix(in oklch, var(--color-primary-content) 95%, transparent)',
      mark:   'var(--color-primary-content)',
      suffix: 'color-mix(in oklch, var(--color-primary-content) 75%, transparent)',
      lines:  'var(--color-primary)',
    },
  };

  const c = $derived(colours[variant] ?? colours.auto);

  // Both viewBoxes are tightly cropped to the actual drawn content (measured via getBBox in a
  // real browser) plus a small even margin on every side — the original 36×36 / 220×44 boxes
  // had ~4-100 units of pure trailing whitespace past the content's right/bottom edge, which
  // isn't visible in the SVG itself but IS visible as a lopsided gap once a flex container
  // centers the whole box (the box, not the ink, was what got centered).
  const vb = $derived(iconOnly ? '-2 0 36 36' : '-3 -3 126 47');
  const h = $derived(iconOnly ? resolvedWidth : Math.round(resolvedWidth * (47 / 126)));
</script>

<svg
  width={resolvedWidth}
  height={h}
  viewBox={vb}
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label={fullName}
  class={className}
>
  <title>{fullName}</title>

  {#if iconOnly}
    <!-- Icon mark only (36×36 grid) -->
    <rect x="0" y="10" width="24" height="24" rx="6" fill={c.back}/>
    <rect x="4" y="6"  width="24" height="24" rx="6" fill={c.mid}/>
    <rect x="8" y="2"  width="24" height="24" rx="6" fill={c.front}/>
    <rect x="13" y="8"  width="13" height="2" rx="1" fill={c.lines} opacity="0.9"/>
    <rect x="13" y="13" width="9"  height="2" rx="1" fill={c.lines} opacity="0.7"/>
    <rect x="13" y="18" width="11" height="2" rx="1" fill={c.lines} opacity="0.5"/>
    <circle cx="10" cy="9"  r="1.4" fill={c.lines} opacity="0.9"/>
    <circle cx="10" cy="14" r="1.4" fill={c.lines} opacity="0.7"/>
    <circle cx="10" cy="19" r="1.4" fill={c.lines} opacity="0.5"/>

  {:else}
    <!-- Horizontal lockup (220×44 grid) -->
    <rect x="0" y="8" width="28" height="28" rx="7" fill={c.back}/>
    <rect x="4" y="4" width="28" height="28" rx="7" fill={c.mid}/>
    <rect x="8" y="0" width="28" height="28" rx="7" fill={c.front}/>
    <rect x="14" y="7"  width="14" height="2" rx="1" fill={c.lines} opacity="0.9"/>
    <rect x="14" y="12" width="10" height="2" rx="1" fill={c.lines} opacity="0.7"/>
    <rect x="14" y="17" width="12" height="2" rx="1" fill={c.lines} opacity="0.5"/>
    <circle cx="11" cy="8"  r="1.5" fill={c.lines} opacity="0.9"/>
    <circle cx="11" cy="13" r="1.5" fill={c.lines} opacity="0.7"/>
    <circle cx="11" cy="18" r="1.5" fill={c.lines} opacity="0.5"/>

    <text x="44" y={suffix ? 20 : 27}
      font-family="'Space Grotesk', system-ui, sans-serif"
      font-size="17"
      font-weight="700"
      fill={c.mark}
      letter-spacing="-0.5">metadose</text>
    {#if suffix}
      <text x="44" y="37"
        font-family="'Space Grotesk', system-ui, sans-serif"
        font-size="13"
        font-weight="300"
        fill={c.suffix}
        letter-spacing="0.5">-{suffix}</text>
    {/if}
  {/if}
</svg>
