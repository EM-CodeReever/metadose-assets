# metadose Brand Kit

Visual identity and design token system for the **metadose** suite.  
This kit covers `metadose-assets` and is designed to scale to future apps (`metadose-monitor`, etc.).

---

## What's in the box

```
metadose-brand-kit/
├── fonts/
│   ├── font-face.css            Self-hosted @font-face declarations
│   ├── download-fonts.sh        One-shot font downloader script
│   └── (SpaceGrotesk-Variable.woff2 + JetBrainsMono-Variable.woff2 after download)
│
├── tokens/
│   ├── tokens.css               Core design tokens  ← import this first
│   ├── tokens.js                ES module token exports (for JS/TS contexts)
│   └── tokens.tailwind.js       Tailwind v3 theme extension
│
├── icons/
│   ├── logo-horizontal.svg      Full lockup — light backgrounds
│   ├── logo-horizontal-dark.svg Full lockup — dark backgrounds
│   ├── logo-horizontal-white.svg Full lockup — on accent/coloured backgrounds
│   ├── icon-mark.svg            Icon only — use below ~80 px wide
│   └── favicon.svg              32×32 favicon (SVG, links at 16/32 px)
│
├── components/
│   ├── Logo.svelte              SvelteKit logo component
│   ├── typography.css           Type utility classes (.md-display, .md-heading-* …)
│   └── components.css           UI component classes (buttons, badges, cards …)
│
└── docs/
    └── README.md                This file
```

---

## Quick start (SvelteKit + DaisyUI)

### 1. Copy the kit into your project

```
src/
└── lib/
    └── brand/         ← paste metadose-brand-kit/ here
        ├── fonts/
        ├── tokens/
        ├── icons/
        └── components/
```

### 2. Import tokens in your global CSS

**Option A — CDN (internet access available):**  
`tokens.css` already imports from Google Fonts. Just import the file:

```css
/* src/app.css */
@import '$lib/brand/tokens/tokens.css';
@import '$lib/brand/components/typography.css';
@import '$lib/brand/components/components.css';
```

**Option B — Self-hosted (Docker / no internet):**

```sh
cd src/lib/brand/fonts
sh download-fonts.sh
```

Then in your CSS, import the local font declarations *before* tokens:

```css
/* src/app.css */
@import '$lib/brand/fonts/font-face.css';   /* ← local fonts first */
@import '$lib/brand/tokens/tokens.css';     /* ← remove its Google Fonts @import */
@import '$lib/brand/components/typography.css';
@import '$lib/brand/components/components.css';
```

Open `tokens/tokens.css` and comment out or delete the first `@import url(...)` line
at the top (the Google Fonts CDN import). The rest of the file is unchanged.

### 3. Use the Logo component

```svelte
<!-- +layout.svelte -->
<script>
  import Logo from '$lib/brand/components/Logo.svelte';
</script>

<!-- Auto-adapts to light/dark OS theme -->
<Logo />

<!-- Force a variant -->
<Logo variant="dark" />
<Logo variant="white" />  <!-- for accent-coloured nav bars -->

<!-- Icon mark only (for sidebar collapsed state, mobile nav, etc.) -->
<Logo iconOnly width={32} />
```

### 4. Wire up the theme toggle (optional)

The token system responds to `prefers-color-scheme` automatically.  
For a manual toggle, set `data-theme` on `<html>`:

```js
// theme.js (store or utility)
export function setTheme(theme) {  // 'light' | 'dark' | 'system'
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('md-theme', theme);
}

export function loadTheme() {
  const saved = localStorage.getItem('md-theme') ?? 'system';
  setTheme(saved);
}
```

Call `loadTheme()` as early as possible (in `<head>` or `+layout.svelte` `onMount`)
to prevent a flash of the wrong theme.

---

## Token reference

All tokens use the `--md-` prefix to avoid collisions.

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--md-bg` | `#F0F2F5` | `#0A0E17` | Page background |
| `--md-bg-card` | `#FFFFFF` | `#111827` | Card / panel surface |
| `--md-bg-muted` | `#E8ECF2` | `#1A2235` | Subtle fills, hover states |
| `--md-fg` | `#0D1117` | `#E8ECF4` | Primary text |
| `--md-fg-muted` | `#374151` | `#9CA3AF` | Secondary text |
| `--md-fg-subtle` | `#6B7280` | `#6B7280` | Tertiary / disabled text |
| `--md-accent` | `#1E6BFF` | `#3D84FF` | Brand blue, interactive elements |
| `--md-accent-hover` | `#1558D6` | `#5A9AFF` | Hover state of accent |
| `--md-accent-soft` | `rgba(30,107,255,.08)` | `rgba(61,132,255,.12)` | Tinted backgrounds |
| `--md-cyan` | `#00C4CC` | `#00D4DC` | Data / secondary accent |
| `--md-success` | `#059669` | `#10B981` | Online / active |
| `--md-warning` | `#D97706` | `#FBBF24` | Warning / maintenance |
| `--md-danger` | `#DC2626` | `#EF4444` | Critical / error |
| `--md-info` | `#2563EB` | `#60A5FA` | Informational |
| `--md-border` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.06)` | Default border |
| `--md-border-strong` | `rgba(0,0,0,.14)` | `rgba(255,255,255,.10)` | Inputs, dividers |
| `--md-border-focus` | `#1E6BFF` | `#3D84FF` | Focus rings |

### Typography

| Token | Value | Use |
|---|---|---|
| `--md-font-ui` | `'Space Grotesk', system-ui, …` | All UI text |
| `--md-font-mono` | `'JetBrains Mono', monospace` | Asset IDs, serials, code |
| `--md-text-xs` | `10px` | Labels, captions |
| `--md-text-sm` | `12px` | Small body |
| `--md-text-base` | `14px` | Default body |
| `--md-text-md` | `16px` | H3 |
| `--md-text-lg` | `20px` | H2 |
| `--md-text-xl` | `24px` | H1 |
| `--md-text-2xl` | `32px` | KPI stat |
| `--md-text-3xl` | `40px` | Display |

### Spacing

8-point grid: `--md-space-1` (4px) → `--md-space-10` (80px).

### Elevation / Shadow

| Token | Use |
|---|---|
| `--md-shadow-sm` | Cards, dropdowns |
| `--md-shadow-md` | Modals, raised panels |
| `--md-shadow-lg` | Overlays |
| `--md-shadow-accent` | Accent-coloured button glow |

---

## Typography classes

| Class | Size | Weight | Use |
|---|---|---|---|
| `.md-display` | 40px | 700 | Hero / page title |
| `.md-heading-1` | 24px | 700 | Primary section headings |
| `.md-heading-2` | 20px | 600 | Sub-section headings |
| `.md-heading-3` | 16px | 600 | Card / panel titles |
| `.md-body` | 14px | 400 | Running copy (max-width: 65ch) |
| `.md-body-sm` | 12px | 400 | Secondary copy |
| `.md-label` | 10px | 600 | Uppercase metadata labels |
| `.md-mono` | 13px | 400 | Asset IDs, serial numbers |
| `.md-caption` | 11px | 400 | Table sub-rows, help text |
| `.md-stat` | 32px | 700 | KPI numbers |

---

## Component classes

### Buttons

```html
<button class="md-btn md-btn-primary">Assign Asset</button>
<button class="md-btn md-btn-secondary">Cancel</button>
<button class="md-btn md-btn-ghost">View details</button>
<button class="md-btn md-btn-danger">Retire</button>
<button class="md-btn md-btn-primary md-btn-sm">Quick add</button>
<button class="md-btn md-btn-icon md-btn-secondary"><!-- icon svg --></button>
```

### Badges (lifecycle status)

```html
<span class="md-badge md-badge-online">Active</span>
<span class="md-badge md-badge-warning">Maintenance</span>
<span class="md-badge md-badge-retired">Retired</span>
<span class="md-badge md-badge-critical">Critical</span>
<span class="md-badge md-badge-info">Pending</span>
```

### Status dots

```html
<span class="md-dot md-dot-online"></span>   <!-- solid green -->
<span class="md-dot md-dot-warning"></span>  <!-- amber -->
<span class="md-dot md-dot-critical"></span> <!-- red -->
<span class="md-dot md-dot-offline"></span>  <!-- grey -->
<span class="md-dot md-dot-pulse"></span>    <!-- animated green (live) -->
```

### Cards

```html
<div class="md-card">Standard card</div>
<div class="md-card md-card-raised">Elevated card</div>
<div class="md-card md-card-accent">Highlighted card (accent border)</div>
```

### Table

```html
<table class="md-table">
  <thead>
    <tr><th>Asset ID</th><th>Name</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="md-asset-id">ASSET-0042</span></td>
      <td>
        MacBook Pro 14"
        <span class="md-cell-sub">Apple M3 Pro · 18 GB</span>
      </td>
      <td><span class="md-badge md-badge-online">Active</span></td>
    </tr>
  </tbody>
</table>
```

### KPI tiles

```html
<div class="md-kpi">
  <span class="md-kpi-value">247</span>
  <span class="md-kpi-label">Total Assets</span>
</div>
<div class="md-kpi md-kpi-danger">
  <span class="md-kpi-value">3</span>
  <span class="md-kpi-label">Critical Issues</span>
</div>
```

### Form fields

```html
<div class="md-field">
  <label for="serial">Serial Number</label>
  <input id="serial" class="md-input md-input-mono" type="text" placeholder="SN-XXXX-XXXX">
  <span class="md-field-help">Found on the underside of the device</span>
</div>
```

---

## Logo usage

| File | Use when… |
|---|---|
| `logo-horizontal.svg` | Light backgrounds — default nav bar, headers |
| `logo-horizontal-dark.svg` | Dark backgrounds — dark nav bar, dark mode headers |
| `logo-horizontal-white.svg` | Coloured / accent backgrounds, printed on dark |
| `icon-mark.svg` | Icon-only contexts — favicon, mobile nav, 32 px or smaller |
| `favicon.svg` | Browser tab icon (link as `<link rel="icon" type="image/svg+xml">`) |

**Minimum width:** 120 px for the horizontal lockup. Below that, use `icon-mark.svg`.

**Clear space:** keep a margin equal to the height of the icon mark on all sides of the logo.

**Don'ts:** don't recolour, rotate, squish, or add drop shadows to the SVG mark. Don't pair the logo with another brand on the same visual level.

**Favicon:**

```html
<!-- In <head> — SVG first, ICO fallback for older browsers -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate icon" href="/favicon.ico">
```

---

## Tailwind v3 integration

```js
// tailwind.config.js
const mdTokens = require('./src/lib/brand/tokens/tokens.tailwind.js');

module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: mdTokens,
  },
  plugins: [],
};
```

Then use Tailwind utilities with brand tokens:

```html
<div class="bg-[var(--md-bg-card)] border border-[var(--md-border)] rounded-lg p-6">
  <p class="text-[var(--md-fg)] font-[family-name:var(--md-font-ui)]">…</p>
</div>
```

Or use the named extensions from `tokens.tailwind.js`:

```html
<div class="bg-md-card border-md-border text-md-fg font-ui">…</div>
```

---

## JS / chart library usage

```js
// For chart libraries (Chart.js, ECharts, etc.) that need hex values
import tokens from '$lib/brand/tokens/tokens.js';

const chartColors = [
  tokens.cobalt,       // #1E6BFF
  tokens.aqua,         // #00C4CC
  tokens.success,      // #059669
  tokens.warning,      // #D97706
  tokens.danger,       // #DC2626
];
```

---

## Extending for metadose-monitor

When building `metadose-monitor`, copy this kit and:

1. In `tokens.css`, change `--md-app-name: 'metadose-assets'` to `metadose-monitor`.
2. The core palette stays identical — consistent across the suite.
3. Add monitor-specific semantic tokens (server state: `--md-server-up`, `--md-server-down`, etc.) in a new `tokens/tokens.monitor.css` that imports `tokens.css` first.
4. Update the logo wordmark suffix from `-assets` to `-monitor` in the relevant SVG files or by passing a prop to `Logo.svelte`.

---

## Typefaces

| Font | Licence | Use |
|---|---|---|
| [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) | SIL Open Font Licence 1.1 | All UI text, headings, labels |
| [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) | SIL Open Font Licence 1.1 | Asset IDs, serial numbers, code |

Both fonts are free to embed and distribute. The OFL is compatible with commercial use.

---

*metadose brand kit — generated 2026*
