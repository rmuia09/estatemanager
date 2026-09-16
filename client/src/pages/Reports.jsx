import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ksh } from '../format.js'

const monthLabel = (key) => {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
}
const weekLabel = (s) => {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}
const monthEndStr = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return `${y}-${mm}-${String(last).padStart(2, '0')}`
}
const shiftMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Reports() {
  const [period, setPeriod] = useState('weekly')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [props, setProps] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [err, setErr] = useState('')

  async function load(initialFrom, initialTo) {
    setLoading(true); setErr('')
    try {
      const p = new URLSearchParams({ period })
      if (propertyId) p.set('property_id', propertyId)
      const f = initialFrom ?? from
      const t = initialTo ?? to
      if ((f || t) && period === 'monthly') {
        if (f) p.set('from', `${f}-01`)
        if (t) p.set('to', monthEndStr(t))
      } else {
        if (f) p.set('from', f)
        if (t) p.set('to', t)
      }
      p.set('limit', '120')
      setSummary(await api.get(`/api/reports/summary?${p}`))
      setSelected(null); setDetail(null)
    } catch (x) { setErr(x.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (period === 'monthly') {
      const toM = new Date().toISOString().slice(0, 7)
      setTo(toM)
      setFrom(shiftMonths(toM, -11))
    } else {
      const today = new Date()
      const toD = today.toISOString().slice(0, 10)
      const fromD = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 77)).toISOString().slice(0, 10)
      setTo(toD)
      setFrom(fromD)
    }
    api.get('/api/properties').then(setProps).catch(() => {})
    setLoading(true)
    const p = new URLSearchParams({ period })
    if (propertyId) p.set('property_id', propertyId)
    p.set('limit', '120')
    api.get(`/api/reports/summary?${p}`).then(setSummary).catch((x) => setErr(x.message)).finally(() => setLoading(false))
  }, [period])

  function pickPeriod(key) {
    setSelected(selected === key ? null : key)
  }

  function loadDetail(key) {
    setDetailLoading(true)
    const p = new URLSearchParams({ period, key })
    if (propertyId) p.set('property_id', propertyId)
    api.get(`/api/reports/period?${p}`).then(setDetail).finally(() => setDetailLoading(false))
  }

  const max = summary ? Math.max(1, ...summary.periods.map((w) => w.total)) : 1
  const label = period === 'monthly' ? monthLabel : weekLabel

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Income reports</h2>
          <p>{period === 'monthly' ? 'Monthly' : 'Weekly'} rent collected, filterable by date range and property</p>
        </div>
        {detail && <button className="btn small secondary" onClick={() => setSelected(null)}>Clear selection</button>}
      </div>

      <div className="card">
        <div className="filters" style={{ marginBottom: 4 }}>
          <div className="seg">
            <button className={`btn small ${period === 'weekly' ? 'primary' : 'secondary'}`} onClick={() => setPeriod('weekly')}>Weekly</button>
            <button className={`btn small ${period === 'monthly' ? 'primary' : 'secondary'}`} onClick={() => setPeriod('monthly')}>Monthly</button>
          </div>
          {period === 'monthly' ? (
            <>
              <input className="inp" type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="muted small">→</span>
              <input className="inp" type="month" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          ) : (
            <>
              <input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="muted small">→</span>
              <input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          <select className="inp" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">All properties</option>
            {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn" onClick={() => load()}>Apply</button>
        </div>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {loading && <div className="loading">Loading report…</div>}

      {summary && !loading && (
        <>
          <div className="stats">
            <div className="stat accent">
              <div className="label">Total collected</div>
              <div className="value">{ksh(summary.grand_total)}</div>
            </div>
            <div className="stat">
              <div className="label">{period === 'monthly' ? 'Months' : 'Weeks'}</div>
              <div className="value">{summary.periods.length}</div>
            </div>
          </div>

          <div className="card">
            <h3>{period === 'monthly' ? 'Monthly' : 'Weekly'} totals</h3>
            <div className="bars">
              {summary.periods.map((w) => (
                <div className="bar-col" key={w.key}>
                  <div
                    className={`bar ${selected === w.key ? 'selected' : ''}`}
                    style={{ height: `${Math.max(3, (w.total / max) * 100)}%` }}
                    onClick={() => { pickPeriod(w.key); setDetail(null) }}
                    title={ksh(w.total)}
                  >
                    <span className="bar-val">{Math.round(w.total / 1000)}k</span>
                  </div>
                  <div className="bar-label">{label(w.key)}</div>
                </div>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 12 }}>Click a bar to load those transactions.</p>
          </div>

          <div className="card">
            <h3>Table</h3>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{period === 'monthly' ? 'Month' : 'Week starts'}</th>
                    {period === 'weekly' && <th>Week ends</th>}
                    <th className="num">Transactions</th>
                    <th className="num">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.periods.map((w) => (
                    <tr key={w.key} style={{ background: selected === w.key ? 'var(--accent-soft)' : undefined }}>
                      <td>{period === 'monthly' ? monthLabel(w.key) : fmtDateSmart(w.key)}</td>
                      {period === 'weekly' && <td className="muted">{fmtDateSmart(w.end)}</td>}
                      <td className="num">{w.txns}</td>
                      <td className="num"><strong>{ksh(w.total)}</strong></td>
                      <td>
                        <button className="btn small secondary" onClick={() => { setSelected(selected === w.key ? null : w.key); loadDetail(w.key) }}>
                          {selected === w.key ? 'Hide' : 'Detail'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {detail && (
        <div className="card">
          <h3>Breakdown — {period === 'monthly' ? monthLabel(detail.key) : `week of ${detail.key}`}</h3>
          <div className="stats" style={{ marginBottom: 16 }}>
            <div className="stat accent"><div className="label">Period total</div><div className="value">{ksh(detail.total)}</div></div>
          </div>
          {detailLoading ? (
            <div className="loading">Loading…</div>
          ) : (
            <>
              <h3 style={{ fontSize: 13, margin: '8px 0 10px' }}>By property</h3>
              <div className="tbl-wrap" style={{ marginBottom: 18 }}>
                <table>
                  <thead><tr><th>Property</th><th className="num">Payments</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {(detail.byProperty || []).map((b) => (
                      <tr key={b.property}>
                        <td>{b.property}</td>
                        <td className="num">{b.txns}</td>
                        <td className="num">{ksh(b.total)}</td>
                      </tr>
                    ))}
                    {(detail.byProperty || []).length === 0 && <tr><td colSpan="3" className="muted">No payments in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
              <h3 style={{ fontSize: 13, margin: '8px 0 10px' }}>Transactions</h3>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Property</th><th>Unit</th><th>Tenant</th><th>Method</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {(detail.details || []).map((d, i) => (
                      <tr key={i}>
                        <td>{fmtDateSmart(d.payment_date)}</td>
                        <td>{d.property_name}</td>
                        <td>{d.unit_number}</td>
                        <td>{d.tenant_name || '—'}</td>
                        <td>{d.method}</td>
                        <td className="num">{ksh(d.amount)}</td>
                      </tr>
                    ))}
                    {(detail.details || []).length === 0 && <tr><td colSpan="6" className="muted">No payments in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function fmtDateSmart(s) {
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''))
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}