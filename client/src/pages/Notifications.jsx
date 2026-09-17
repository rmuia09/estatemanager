import { useEffect, useMemo, useState } from 'react'
import { api, useResource } from '../api.js'
import { fmtDate } from '../format.js'
import Paginator, { usePagination } from '../components/Paginator.jsx'

const statusBadge = (s) =>
  s === 'sent' ? <span className="badge ok">sent</span>
  : s === 'failed' ? <span className="badge danger">failed</span>
  : s === 'simulated' ? <span className="badge simulated">simulated</span>
  : <span className="badge neutral">{s}</span>

export default function Notifications() {
  const { data: notifs, loading, error, refresh } = useResource('/api/notifications?limit=300')
  const { data: stats, refresh: refreshStats } = useResource('/api/notifications/stats')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [fKind, setFKind] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fText, setFText] = useState('')

  async function runReminders() {
    setBusy(true); setErr('')
    try {
      const r = await api.post('/api/reminders/run', {})
      setMsg(`Reminder engine checked ${r.checked} lease(s); sent ${r.sent.length}`)
      refresh(); refreshStats()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  const shown = useMemo(() => {
    if (!notifs) return []
    return notifs.filter((n) => {
      if (fKind && n.kind !== fKind) return false
      if (fStatus && n.status !== fStatus) return false
      if (fText && !`${n.recipient || ''} ${n.tenant_name || ''} ${n.unit_number || ''}`.toLowerCase().includes(fText.toLowerCase())) return false
      return true
    })
  }, [notifs, fKind, fStatus, fText])

  const { page, setPage, totalItems, totalPages, pageItems } = usePagination(shown, 20)
  useEffect(() => setPage(1), [fKind, fStatus, fText])

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Notifications</h2>
          <p>Renewal reminders, rent-due messages and delivery status (SMS / email)</p>
        </div>
        <button className="btn" disabled={busy} onClick={runReminders}>{busy ? 'Running…' : '▶ Run automated reminders now'}</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}

      {stats && (
        <div className="stats">
          {Object.entries(stats.reduce((acc, r) => {
            const k = `${r.status} ${r.channel}`
            acc[k] = (acc[k] || 0) + r.c
            return acc
          }, {})).map(([k, v]) => (
            <div className="stat" key={k}>
              <div className="label">{k}</div>
              <div className="value" style={{ fontSize: 22 }}>{v}</div>
            </div>
          ))}
          {stats.length === 0 && <div className="stat"><div className="label">No messages yet</div><div className="value">0</div></div>}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h3>Message history</h3>
          <div className="filters">
            <input className="inp" placeholder="Search recipient / tenant…" value={fText} onChange={(e) => setFText(e.target.value)} />
            <select value={fKind} onChange={(e) => setFKind(e.target.value)}>
              <option value="">All kinds</option>
              <option value="reminder">Reminder</option>
              <option value="rent_due">Rent due</option>
              <option value="test">Test</option>
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="simulated">Simulated</option>
              <option value="failed">Failed</option>
            </select>
            {(fText || fKind || fStatus) && <button className="btn small secondary" onClick={() => { setFText(''); setFKind(''); setFStatus('') }}>Clear</button>}
          </div>
        </div>

        {loading && <div className="loading">Loading notifications…</div>}
        {error && <div className="error-banner">{error}</div>}

        {shown.length === 0 && !loading && <p className="empty">No notification messages yet. Run reminders or send a notice to begin.</p>}

        {shown.length > 0 && (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Channel</th><th>Kind</th><th>Recipient</th><th>Tenant / Unit</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {pageItems.map((n) => (
                  <tr key={n.id} onClick={() => setExpanded(expanded === n.id ? null : n.id)} style={{ cursor: 'pointer' }}>
                    <td data-label="Time" className="small muted">{fmtDate(n.created_at)}</td>
                    <td data-label="Channel"><span className="badge neutral">{n.channel === 'sms' ? '📱 SMS' : '✉️ Email'}</span></td>
                    <td data-label="Kind" className="small">{n.kind}</td>
                    <td data-label="Recipient" className="small">{n.recipient}</td>
                    <td data-label="Tenant / Unit" className="small">{n.tenant_name || '—'}{n.unit_number ? ` · ${n.unit_number}` : ''}</td>
                    <td data-label="Status">{statusBadge(n.status)}{n.message_id ? <div className="muted small">id {n.provider_message_id}</div> : null}</td>
                    <td data-label="" className="small">{expanded === n.id ? '▲' : '▼'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
            {expanded && notifs && (() => {
              const n = notifs.find((x) => x.id === expanded)
              if (!n) return null
              return (
                <div style={{ marginTop: 14, padding: '0 10px 6px' }}>
                  <p className="small"><strong>Subject:</strong> {n.subject}</p>
                  <pre className="msg-body" style={{ marginTop: 8 }}>{n.body}</pre>
                  {n.error && <p className="small" style={{ color: 'var(--danger)', marginTop: 8 }}>Error: {n.error}</p>}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}