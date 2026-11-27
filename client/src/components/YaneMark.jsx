// Yane brand mark: a roof (chevron) over two rounded ledger lines,
// inside a rounded square. Variants: 'solid' (brown container, cream glyph,
// clay bottom line) and 'onDark' (cream container, espresso glyph).
export default function YaneMark({ size = 44, variant = 'solid', style }) {
  const container = variant === 'onDark' ? '#f7f2ec' : '#6b3f2a'
  const glyph = variant === 'onDark' ? '#2b1b14' : '#f7f2ec'
  const ledger = variant === 'onDark' ? '#6b3f2a' : '#d9b48a'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={style} aria-hidden="true">
      <rect width="48" height="48" rx="13" fill={container} />
      <path d="M11 25 L24 13 L37 25" fill="none" stroke={glyph} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="15" y1="32" x2="33" y2="32" stroke={glyph} strokeWidth="3.6" strokeLinecap="round" />
      <line x1="15" y1="39" x2="27" y2="39" stroke={ledger} strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  )
}
