import { useState } from 'react'
import { motion } from 'framer-motion'
import MotionCard from '../components/MotionCard.jsx'
import NumberCounter from '../components/NumberCounter.jsx'
import { useResource } from '../api.js'
import { ksh, fmtDate } from '../format.js'
import { design } from '../design-system.js'

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

  function Stat({ className = '', delay = 0, children }) {
    return (
      <motion.div
        className={`stat ${className}`}
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: design.motion.durations.reveal, delay, ease: design.motion.easings.smooth }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of rentals, income and pending actions</p>
        </div>
        <div className="head-actions">
          <button className="btn small" onClick={() => onNavigate('payments')}>+ Record payment</button>
          <button className="btn small secondary" onClick={() => onNavigate('tenants')}>+ Add tenant</button>
        </div>
      </div>

      <div className="stats">
        <Stat delay={0.05}>
          <div className="label">Total units</div>
          <div className="value"><NumberCounter value={s.totalUnits} /></div>
          <div className="sub">across the estate</div>
        </Stat>
        <Stat delay={0.11} className="good">
          <div className="label">Occupied</div>
          <div className="value"><NumberCounter value={s.occupiedUnits} /></div>
          <div className="sub">{s.vacantUnits} vacant</div>
        </Stat>
        <Stat delay={0.17} className="accent">
          <div className="label">Expected rent / month</div>
          <div className="value"><NumberCounter value={s.expectedMonthly} prefix="KSh " /></div>
          <div className="sub">from active leases</div>
        </Stat>
        <Stat delay={0.23}>
          <div className="label">Collected this month</div>
          <div className="value"><NumberCounter value={s.collectedMonth} prefix="KSh " /></div>
          <div className="sub"><NumberCounter value={monthPct} suffix="%" /> of expected</div>
          <div className="progress" aria-label={`${monthPct}% collected`}><span style={{ width: `${Math.min(monthPct, 100)}%` }} /></div>
        </Stat>
        {s.monthOutstanding > 0 && (
          <Stat delay={0.29} className="warn">
            <div className="label">Outstanding this month</div>
            <div className="value"><NumberCounter value={s.monthOutstanding} prefix="KSh " /></div>
            <div className="sub">rent not yet paid</div>
          </Stat>
        )}
        <Stat delay={0.35}>
          <div className="label">Pending utility bills</div>
          <div className="value"><NumberCounter value={s.pendingUtility} prefix="KSh " /></div>
          <div className="sub">water &amp; electricity</div>
        </Stat>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
        <MotionCard>
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
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.25, ease: design.motion.easings.smooth }}
                  >
                    <td data-label="Date">{fmtDate(p.payment_date)}</td>
                    <td data-label="Property">{p.property_name}</td>
                    <td data-label="Unit">{p.unit_number}</td>
                    <td data-label="Tenant">{p.tenant_name || '—'}</td>
                    <td data-label="Method"><span className={`method method-${String(p.method).toLowerCase().replace(/[^a-z]/g, '')}`}>{p.method}</span></td>
                    <td data-label="Amount" className="num">{ksh(p.amount)}</td>
                  </motion.tr>
                ))}
              {recentPayments.length === 0 && <tr><td data-label="Date" colSpan="6" className="muted">No recent payments match.</td></tr>}
              </tbody>
            </table>
          </div>
        </MotionCard>

        <MotionCard>
          <div className="card-title">
            <h3>Lease renewals due</h3>
            <input className="inp" placeholder="Filter renewals…" value={renewFilter} onChange={(e) => setRenewFilter(e.target.value)} />
            <button className="btn small secondary" onClick={() => onNavigate('renewals')}>Manage</button>
          </div>
          {expiringSoon.length === 0 ? (
            <p className="muted">{renewFilter ? 'No renewals match your filter.' : 'No leases expiring in the next 60 days.'}</p>
          ) : (
            expiringSoon.map((l) => (
              <motion.div
                className="renewal-line"
                key={l.id}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: design.motion.easings.smooth }}
              >
                <div style={{ flex: 1 }}>
                  <div><strong>{l.unit_number}</strong> <span className="muted">· {l.tenant_name}</span></div>
                  <div className="small muted">Ends {fmtDate(l.end_date)} · {l.property_name}</div>
                </div>
                <span className={`badge ${l.days_left < 0 ? 'danger' : l.days_left <= 30 ? 'warn' : 'neutral'}`}>
                  {l.days_left < 0 ? 'Overdue' : `${l.days_left}d left`}
                </span>
                <button className="btn small secondary" onClick={() => onNavigate('renewals')}>Renew</button>
              </motion.div>
            ))
          )}
        </MotionCard>
      </div>
    </div>
  )
}