// Design system — the "frontend design skill" layer from the guide:
// real type scale, 8px spacing grid, color tokens, component patterns.
//
// Color roles follow the Yane brand sheet (60-30-10):
//   60% dominant  — Cream surfaces + Espresso ink (keep them quiet)
//   30% secondary — Yane Brown: sidebar, ghost buttons, chips, focus rings
//   10% accent    — Clay Tan for graphics; CTAs use Yane Brown
export const design = {
  colors: {
    primary: '#6b3f2a',
    primaryDark: '#553020',
    primarySoft: '#f0e6d8',
    accent: '#d9b48a',
    accentDark: '#b98f5e',
    accentSoft: '#f7f2ec',
    ink: '#2b1b14',
    muted: '#8a7a68',
    line: '#e9dfd2',
    bg: '#f7f2ec',
    panel: '#fffdf9',
    warn: '#9c6b38',
    warnSoft: '#f9edd2',
    danger: '#a33c30',
    dangerSoft: '#f7e0dd',
    ok: '#6b3f2a',
    okSoft: '#f0e6d8',
  },
  spacing: {
    1: '4px', 2: '8px', 3: '12px', 4: '16px',
    5: '20px', 6: '24px', 7: '32px', 8: '40px', 9: '48px',
  },
  type: {
    h1: { size: '34px', weight: 700, lineHeight: 1.15 },
    h2: { size: '26px', weight: 700, lineHeight: 1.2 },
    h3: { size: '19px', weight: 650, lineHeight: 1.3 },
    h4: { size: '15px', weight: 600, lineHeight: 1.3 },
    label: { size: '11px', weight: 600, letterSpacing: '0.6px' },
    body: { size: '14px', weight: 400, lineHeight: 1.5 },
    small: { size: '12px', weight: 400, lineHeight: 1.5 },
  },
  radius: { card: '16px', inner: '12px', input: '10px', pill: '999px' },
  shadow: {
    card: '0 1px 3px rgba(43, 27, 20, 0.06), 0 8px 24px -16px rgba(43, 27, 20, 0.18)',
    hover: '0 8px 20px -10px rgba(43, 27, 20, 0.26)',
  },
  motion: {
    durations: { fast: 0.12, base: 0.2, reveal: 0.35, panel: 0.4 },
    easings: {
      smooth: [0.22, 1, 0.36, 1],
      gentle: [0.4, 0, 0.2, 1],
    },
  },
  // Component patterns — buttons, stat cards, cards, badges.
  patterns: {
    buttonPadding: { small: '6px 12px', medium: '9px 16px', large: '11px 20px' },
    cardRadius: '16px',
    hoverElevate: 'y(-4px)',
  },
}
