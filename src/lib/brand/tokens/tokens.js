/**
 * metadose Design Tokens — JavaScript / ES Module
 * ─────────────────────────────────────────────────────────────────
 * Use these in Svelte, Vue, React, or any JS context where you need
 * token values at runtime (e.g. canvas drawing, chart config, email templates).
 *
 * Import:
 *   import { tokens, palette, typography } from './tokens/tokens.js';
 *
 * For Tailwind or UnoCSS, see tokens.tailwind.js
 * ─────────────────────────────────────────────────────────────────
 */

export const palette = {
  // Primary accent
  cobalt:        '#1E6BFF',
  cobaltDark:    '#3D84FF',   // dark-theme value
  cobaltHover:   '#1558D6',
  cobaltSoft:    '#E8EFFF',
  cobaltSoftDark:'#1A2845',

  // Secondary
  aqua:          '#00C4CC',
  aquaDark:      '#00D4DC',
  aquaSoft:      '#E0FAFB',
  aquaSoftDark:  '#0A2A2C',

  // Semantic
  success:       '#059669',
  successDark:   '#34D399',
  successBg:     '#D1FAE5',
  successBgDark: '#052A1A',

  warning:       '#F59E0B',
  warningDark:   '#FCD34D',
  warningBg:     '#FEF3C7',
  warningBgDark: '#1C1200',

  danger:        '#EF4444',
  dangerDark:    '#F87171',
  dangerBg:      '#FEF2F2',
  dangerBgDark:  '#1F0A0A',

  info:          '#3B82F6',
  infoDark:      '#60A5FA',
  infoBg:        '#EFF6FF',
  infoBgDark:    '#0A1A2E',

  // Neutrals — light
  bgLight:       '#F0F2F5',
  bgCard:        '#FFFFFF',
  bgMuted:       '#E4E8EF',
  fg:            '#0D1117',
  fgMuted:       '#4A5568',
  fgSubtle:      '#8898AA',
  border:        '#D1D9E6',
  borderStrong:  '#B0BBCC',

  // Neutrals — dark
  bgDark:        '#0A0E17',
  bgCardDark:    '#111827',
  bgMutedDark:   '#1A2235',
  fgDark:        '#E8ECF4',
  fgMutedDark:   '#8FA3BF',
  fgSubtleDark:  '#4A607A',
  borderDark:    '#1E2D45',
  borderStrongDark:'#2A3F5F',
};

export const typography = {
  fontUi:    "'Space Grotesk', system-ui, -apple-system, sans-serif",
  fontMono:  "'JetBrains Mono', 'Courier New', monospace",

  // Google Fonts URLs (self-host alternative below)
  googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap',

  scale: {
    xs:   '10px',
    sm:   '12px',
    base: '14px',
    md:   '16px',
    lg:   '20px',
    xl:   '24px',
    '2xl':'32px',
    '3xl':'40px',
  },

  weight: {
    light:    300,
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },

  leading: {
    tight:   1.1,
    snug:    1.35,
    normal:  1.5,
    relaxed: 1.65,
  },

  tracking: {
    tight:   '-0.03em',
    snug:    '-0.01em',
    normal:  '0',
    wide:    '0.04em',
    wider:   '0.08em',
    widest:  '0.12em',
  },
};

export const spacing = {
  1:  '4px',
  2:  '8px',
  3:  '12px',
  4:  '16px',
  5:  '20px',
  6:  '24px',
  8:  '32px',
  10: '40px',
  12: '48px',
  16: '64px',
};

export const radius = {
  sm:   '6px',
  base: '10px',
  lg:   '16px',
  xl:   '24px',
  pill: '9999px',
};

export const shadow = {
  sm:     '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)',
  md:     '0 4px 16px rgba(0,0,0,.10), 0 2px 4px rgba(0,0,0,.06)',
  lg:     '0 12px 40px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.06)',
  accent: '0 2px 12px rgba(30,107,255,.30)',
};

export const motion = {
  ease:     'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut:  'cubic-bezier(0, 0, 0.2, 1)',
  fast:     '100ms',
  base:     '200ms',
  slow:     '350ms',
};

/** Convenience: flat token map for use with chart libraries */
export const tokens = {
  ...palette,
  ...typography,
  spacing,
  radius,
  shadow,
  motion,
};

export default tokens;
