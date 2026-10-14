/**
 * metadose Tailwind CSS v3 / v4 theme extension
 * ─────────────────────────────────────────────────────────────────
 * tailwind.config.js (v3):
 *   const mdTokens = require('./tokens/tokens.tailwind.js');
 *   module.exports = { theme: { extend: mdTokens } };
 *
 * tailwind.config.ts (v3, TypeScript):
 *   import mdTokens from './tokens/tokens.tailwind.js';
 *   export default { theme: { extend: mdTokens } };
 *
 * For Tailwind v4, copy the CSS custom properties from tokens.css
 * into your @theme block instead of using this file.
 * ─────────────────────────────────────────────────────────────────
 */

/** @type {import('tailwindcss').Config['theme']} */
const mdTokens = {
  colors: {
    md: {
      // Accent
      accent:       'var(--md-accent)',
      'accent-hover':'var(--md-accent-hover)',
      'accent-glow': 'var(--md-accent-glow)',
      'accent-soft': 'var(--md-accent-soft)',

      // Secondary
      cyan:         'var(--md-cyan)',
      'cyan-soft':  'var(--md-cyan-soft)',

      // Backgrounds
      bg:           'var(--md-bg)',
      'bg-card':    'var(--md-bg-card)',
      'bg-muted':   'var(--md-bg-muted)',

      // Foregrounds
      fg:           'var(--md-fg)',
      'fg-muted':   'var(--md-fg-muted)',
      'fg-subtle':  'var(--md-fg-subtle)',
      'fg-inverse': 'var(--md-fg-inverse)',

      // Semantic
      success:      'var(--md-success)',
      'success-bg': 'var(--md-success-bg)',
      warning:      'var(--md-warning)',
      'warning-bg': 'var(--md-warning-bg)',
      danger:       'var(--md-danger)',
      'danger-bg':  'var(--md-danger-bg)',
      info:         'var(--md-info)',
      'info-bg':    'var(--md-info-bg)',

      // Borders
      border:       'var(--md-border)',
      'border-strong':'var(--md-border-strong)',
      'border-focus':'var(--md-border-focus)',
    },
  },

  fontFamily: {
    ui:   ['Space Grotesk', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['JetBrains Mono', 'Courier New', 'monospace'],
  },

  fontSize: {
    'md-xs':   ['10px', { lineHeight: '1.4', letterSpacing: '0.08em' }],
    'md-sm':   ['12px', { lineHeight: '1.5' }],
    'md-base': ['14px', { lineHeight: '1.65' }],
    'md-md':   ['16px', { lineHeight: '1.5' }],
    'md-lg':   ['20px', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
    'md-xl':   ['24px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
    'md-2xl':  ['32px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
    'md-3xl':  ['40px', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
  },

  borderRadius: {
    'md-sm':   '6px',
    'md':      '10px',
    'md-lg':   '16px',
    'md-xl':   '24px',
    'md-pill': '9999px',
  },

  boxShadow: {
    'md-sm':     '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)',
    'md-md':     '0 4px 16px rgba(0,0,0,.10), 0 2px 4px rgba(0,0,0,.06)',
    'md-lg':     '0 12px 40px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.06)',
    'md-accent': '0 2px 12px rgba(30,107,255,.30)',
  },

  spacing: {
    'md-1':  '4px',
    'md-2':  '8px',
    'md-3':  '12px',
    'md-4':  '16px',
    'md-5':  '20px',
    'md-6':  '24px',
    'md-8':  '32px',
    'md-10': '40px',
    'md-12': '48px',
    'md-16': '64px',
  },
};

module.exports = mdTokens;
