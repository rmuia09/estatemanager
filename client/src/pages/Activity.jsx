import { useMemo, useState } from 'react'
import { useResource } from '../api.js'

export default function Activity() {
  const { data: entries, loading, error } = useResource('/api/activity?limit=400')
  const [fText, setFText] = useState('')
  const [fAction, setFAction] = useState('')

  const actions = useMemo(() => {
    const set = new Set((entries || []).map((e) => e.action))
    return [...set].sort()
  }, [entries])

  const shown = useMemo(() => {
    if (!entries) return []
    return entries.filter((e) => {
      if (fAction && e.action !== fAction) return false
      if (fText) {
        const q = fText.toLowerCase()
        if (!`${e.username || ''} ${e.action || ''} ${e.entity_type || ''} ${e.reason || ''} ${e.details || ''}`.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [entries, fAction, fText])

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Activity &amp; audit trail</h2>
          <p>Every major action performed by each user — who did what, when and why</p>
        </div>
      </div>

      {loading && <div className="loading">Loading activity…</div>}
      {error && <div className="error-banner">{error}</div>}

      {entries && (
        <div className="card">
          <div className="card-title">
            <h3>Recent actions <span className="muted">({shown.length})</span></h3>
            <div className="filters">
              <input className="inp" placeholder="Search user, action, entity, reason…" value={fText} onChange={(e) => setFText(e.target.value)} />
              <select value={fAction} onChange={(e) => setFAction(e.target.value)}>
                <option value="">All action types</option>
                {actions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {(fText || fAction) && <button className="btn small secondary" onClick={() => { setFText(''); setFAction('') }}>Clear</button>}
            </div>
          </div>

          {shown.length === 0 && <p className="empty">No activity logged yet.</p>}
          {shown.length > 0 && (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Reason</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {shown.map((e) => (
                    <tr key={e.id}>
                      <td data-label="When" className="small muted activity-when">{e.created_at || ''}</td>
                      <td data-label="User" className="small">{e.username || 'system'}</td>
                      <td data-label="Action"><span className="badge neutral">{e.action}</span></td>
                      <td data-label="Entity" className="small">{e.entity_type}{e.entity_id ? ` #${e.entity_id}` : ''}</td>
                      <td data-label="Reason" className="small">{e.reason || '—'}</td>
                      <td data-label="Details" className="small muted">{e.details || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}