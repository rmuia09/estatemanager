// Design system — the "frontend design skill" layer from the guide:
// real type scale, 8px spacing grid, color tokens, component patterns.
export const design = {
  colors: {
    primary: '#0f766e',
    primaryDark: '#115e59',
    primarySoft: '#edf7f6',
    accent: '#e74c3c',
    accentSoft: '#fdecea',
    ink: '#1c2b36',
    muted: '#6b7785',
    line: '#e4e9ef',
    bg: '#f4f6f9',
    panel: '#ffffff',
    warn: '#b45309',
    warnSoft: '#fef3e2',
    danger: '#b91c1c',
    dangerSoft: '#fee9e9',
    ok: '#15803d',
    okSoft: '#e7f6eb',
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
    card: '0 1px 3px rgba(16, 42, 67, 0.06), 0 8px 24px -16px rgba(16, 42, 67, 0.18)',
    hover: '0 8px 20px -10px rgba(16, 42, 67, 0.26)',
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
