export const ksh = (n) => 'KSh ' + Math.round(Number(n || 0)).toLocaleString('en-KE')

export const ksh2 = (n) =>
  'KSh ' + Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtDate = (s) => {
  if (!s) return ''
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return s
  return new Date(y, m - 1, d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const currentMonth = () => todayStr().slice(0, 7)