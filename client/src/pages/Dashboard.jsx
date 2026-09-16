import { useState } from 'react'
import { useResource } from '../api.js'
import { ksh, fmtDate } from '../format.js'

export default function Dashboard({ onNavigate }) {
  const { data, loading, error } = useResource('/api/dashboard')
  const [payFilter, setPayFilter] = useState('')
  const [renewFilter, setRenewFilter] = useState('')

  if (loading) return <div className="loading">Loading dashboard…</div>
  if (error) return (
    <div className="card">
      <div className="error-banner">{error}</div>
      <p className="muted">Make sure the server is running on port 4000.</p>
    </div>
  )

  const s = data
  const monthPct = s.expectedMonthly ? Math.round((s.collectedMonth / s.expectedMonthly) * 100) : 0

  const recentPayments = s.recentPayments.filter((p) => {
    if (!payFilter) return true
    const q = payFilter.toLowerCase()
    return `${p.unit_number} ${p.tenant_name || ''} ${p.property_name} ${p.method} ${p.payment_date}`.toLowerCase().includes(q)
  })
  const expiringSoon = s.expiringSoon.filter((l) => {
    if (!renewFilter) return true
    const q = renewFilter.toLowerCase()
    return `${l.unit_number} ${l.tenant_name} ${l.property_name} ${l.end_date}`.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of rentals, income and pending actions</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">Total units</div>
          <div className="value">{s.totalUnits}</div>
          <div className="sub">across the estate</div>
        </div>
        <div className="stat good">
          <div className="label">Occupied</div>
          <div className="value">{s.occupiedUnits}</div>
          <div className="sub">{s.vacantUnits} vacant</div>
        </div>
        <div className="stat accent">
          <div className="label">Expected rent / month</div>
          <div className="value">{ksh(s.expectedMonthly)}</div>
          <div className="sub">from active leases</div>
        </div>
        <div className="stat">
          <div className="label">Collected this month</div>
          <div className="value">{ksh(s.collectedMonth)}</div>
          <div className="sub">{monthPct}% of expected</div>
        </div>
        {s.monthOutstanding > 0 && (
          <div className="stat warn">
            <div className="label">Outstanding this month</div>
            <div className="value">{ksh(s.monthOutstanding)}</div>
            <div className="sub">rent not yet paid</div>
          </div>
        )}
        <div className="stat">
          <div className="label">Pending utility bills</div>
          <div className="value">{ksh(s.pendingUtility)}</div>
          <div className="sub">water &amp; electricity</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <h3>Recent payments</h3>
            <input className="inp" placeholder="Filter payments…" value={payFilter} onChange={(e) => setPayFilter(e.target.value)} />
            <button className="btn small secondary" onClick={() => onNavigate('payments')}>View all</button>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Date</th><th>Property</th><th>Unit</th><th>Tenant</th><th>Method</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.payment_date)}</td>
                    <td>{p.property_name}</td>
                    <td>{p.unit_number}</td>
                    <td>{p.tenant_name || '—'}</td>
                    <td>{p.method}</td>
                    <td className="num">{ksh(p.amount)}</td>
                  </tr>
                ))}
              {recentPayments.length === 0 && <tr><td colSpan="6" className="muted">No recent payments match.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <h3>Lease renewals due</h3>
            <input className="inp" placeholder="Filter renewals…" value={renewFilter} onChange={(e) => setRenewFilter(e.target.value)} />
            <button className="btn small secondary" onClick={() => onNavigate('renewals')}>Manage</button>
          </div>
          {expiringSoon.length === 0 ? (
            <p className="muted">{renewFilter ? 'No renewals match your filter.' : 'No leases expiring in the next 60 days.'}</p>
          ) : (
            expiringSoon.map((l) => (
              <div className="renewal-line" key={l.id}>
                <div style={{ flex: 1 }}>
                  <div><strong>{l.unit_number}</strong> <span className="muted">· {l.tenant_name}</span></div>
                  <div className="small muted">Ends {fmtDate(l.end_date)} · {l.property_name}</div>
                </div>
                <span className={`badge ${l.days_left < 0 ? 'danger' : l.days_left <= 30 ? 'warn' : 'neutral'}`}>
                  {l.days_left < 0 ? 'Overdue' : `${l.days_left}d left`}
                </span>
                {!l.notice_sent && <span className="badge danger">notice</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}