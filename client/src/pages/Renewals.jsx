import { useState } from 'react'
import { api, useResource } from '../api.js'
import { ksh, fmtDate, todayStr } from '../format.js'
import Modal from '../components/Modal.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'

const badgeFor = (d) => {
  if (d < 0) return <span className="badge danger">Overdue</span>
  if (d <= 30) return <span className="badge danger">{d} days</span>
  if (d <= 60) return <span className="badge warn">{d} days</span>
  return <span className="badge ok">{d} days</span>
}

export default function Renewals() {
  const { data: leases, loading, error, refresh } = useResource('/api/leases')
  const { data: units } = useResource('/api/units')
  const { data: tenants } = useResource('/api/tenants')

  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [confirmTerminate, setConfirmTerminate] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)

  const [newLease, setNewLease] = useState({ unit_id: '', tenant_id: '', start_date: todayStr(), end_date: '', monthly_rent: '', renewal_months: 12 })
  const [editLease, setEditLease] = useState({ start_date: '', end_date: '', monthly_rent: '', renewal_months: 12 })
  const [filterText, setFilterText] = useState('')
  const [filterProp, setFilterProp] = useState('')

  const vacantUnits = (units || []).filter((u) => u.status !== 'occupied')

  async function sendNotice(l) {
    setBusy('notice' + l.id)
    try { await api.patch(`/api/leases/${l.id}/notice`, {}); refresh(); setMsg(`Notice marked as sent for ${l.unit_number}`) }
    catch (e) { setErr(e.message) } finally { setBusy(null) }
  }

  async function renew(l) {
    setBusy('renew' + l.id)
    try {
      const r = await api.post(`/api/leases/${l.id}/renew`, {})
      refresh()
      setMsg(`${l.unit_number} renewed → ${ksh(r.new_rent)} (from ${fmtDate(r.start_date)} to ${fmtDate(r.end_date)})`)
    } catch (e) { setErr(e.message) } finally { setBusy(null) }
  }

  async function terminate() {
    setBusy('terminate')
    try {
      await api.post(`/api/leases/${confirmTerminate.id}/terminate`, {})
      setConfirmTerminate(null)
      refresh()
      setMsg(`${confirmTerminate.unit_number} lease ended, unit marked vacant`)
    } catch (e) { setErr(e.message) } finally { setBusy(null) }
  }

  async function createLease(e) {
    e.preventDefault()
    setErr('')
    try {
      const r = await api.post('/api/leases', { ...newLease, monthly_rent: Number(newLease.monthly_rent) })
      setAdding(false)
      refresh()
      setMsg(`New tenancy created for unit ${newLease.unit_id ? units.find((u) => u.id === Number(newLease.unit_id)).unit_number : ''}`)
      setNewLease({ unit_id: '', tenant_id: '', start_date: todayStr(), end_date: '', monthly_rent: '', renewal_months: 12 })
    } catch (x) { setErr(x.message) }
  }

  function openEdit(l) {
    setEditLease({ start_date: l.start_date, end_date: l.end_date, monthly_rent: l.monthly_rent, renewal_months: l.renewal_months || 12 })
    setEditing(l)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setErr('')
    try {
      await api.patch(`/api/leases/${editing.id}`, { ...editLease, monthly_rent: Number(editLease.monthly_rent), renewal_months: Number(editLease.renewal_months) })
      setEditing(null)
      refresh()
      setMsg(`Lease for ${editing.unit_number} updated`)
    } catch (x) { setErr(x.message) }
  }

  async function removeLease(reason) {
    setErr('')
    try {
      await api.del(`/api/leases/${confirmDel.id}`, { reason })
      setConfirmDel(null)
      refresh()
      setMsg(`Lease for ${confirmDel.unit_number} deleted, unit ${confirmDel.unit_number} marked vacant`)
    } catch (x) { setErr(x.message) }
  }

  const filtered = leases
    ? leases.filter((l) => {
        if (filterProp && l.property_name !== filterProp) return false
        if (filterText) {
          const q = filterText.toLowerCase()
          if (!`${l.tenant_name} ${l.unit_number} ${l.telephone || l.phone || ''}`.toLowerCase().includes(q)) return false
        }
        return true
      })
    : []

  const overdue = filtered.filter((l) => l.days_left < 0)
  const due = filtered.filter((l) => l.days_left >= 0 && l.days_left <= 60)
  const later = filtered.filter((l) => l.days_left > 60)

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Lease renewals</h2>
          <p>Renewals due 2 months before expiry; renewals apply a 10% rent increment</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>+ New tenancy</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}
      {loading && <div className="loading">Loading leases…</div>}

      {leases && (
        <>
          <div className="stats">
            <div className="stat"><div className="label">Active leases</div><div className="value">{leases.length}</div></div>
            <div className="stat warn"><div className="label">Due in 60 days</div><div className="value">{due.length}</div></div>
            <div className="stat"><div className="label">Overdue</div><div className="value" style={{ color: overdue.length ? 'var(--danger)' : undefined }}>{overdue.length}</div></div>
            <div className="stat good"><div className="label">OK (&gt; 60 days)</div><div className="value" style={{ color: 'var(--ok)' }}>{later.length}</div></div>
          </div>

          {overdue.length > 0 && (
            <div className="card">
              <h3 style={{ color: 'var(--danger)' }}>Overdue renewals</h3>
              <RenewalTable rows={overdue} busy={busy} onNotice={sendNotice} onRenew={renew} onEdit={openEdit} onTerminate={setConfirmTerminate} onDelete={setConfirmDel} />
            </div>
          )}

          <div className="card">
            <h3>Due within 60 days</h3>
            <RenewalTable rows={due} busy={busy} onNotice={sendNotice} onRenew={renew} onEdit={openEdit} onTerminate={setConfirmTerminate} onDelete={setConfirmDel} />
          </div>

          <div className="card">
            <h3>All active leases</h3>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Property</th><th>Unit</th><th>Tenant</th><th>Phone</th><th className="num">Rent</th>
                    <th>Start</th><th>End</th><th>Time left</th><th>Notice</th><th></th></tr>
                </thead>
                <tbody>
                  {later.map((l) => (
                    <LeaseRow key={l.id} l={l} busy={busy} onNotice={sendNotice} onEdit={openEdit} onDelete={setConfirmDel} showRenew={false} badgeFor={badgeFor} ksh={ksh} fmtDate={fmtDate} />
                  ))}
                  {later.length === 0 && <tr><td data-label="Property" colSpan="10" className="muted">No other active leases.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {adding && (
        <Modal title="New tenancy (assign unit)" onClose={() => setAdding(false)}>
          {err && <div className="error-banner">{err}</div>}
          <form onSubmit={createLease}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Unit (vacant) *</label>
                <select value={newLease.unit_id} onChange={(e) => {
                  const id = e.target.value
                  setNewLease({ ...newLease, unit_id: id, monthly_rent: id ? units.find((u) => u.id === Number(id)).monthly_rent : '' })
                }} required>
                  <option value="">Select unit…</option>
                  {vacantUnits.map((u) => <option key={u.id} value={u.id}>{u.property_name} · {u.unit_number} ({ksh(u.monthly_rent)})</option>)}
                  {vacantUnits.length === 0 && <option disabled>No vacant units</option>}
                </select>
                {vacantUnits.length === 0 && <span className="hint">All units are occupied. Mark a unit vacant or add a new unit first.</span>}
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Tenant *</label>
                <select value={newLease.tenant_id} onChange={(e) => setNewLease({ ...newLease, tenant_id: e.target.value })} required>
                  <option value="">Select tenant…</option>
                  {tenants && tenants.map((t) => <option key={t.id} value={t.id}>{t.name}{t.phone ? ` · ${t.phone}` : ''}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Start date *</label>
                <input type="date" value={newLease.start_date} onChange={(e) => setNewLease({ ...newLease, start_date: e.target.value })} required />
              </div>
              <div className="field">
                <label>End date *</label>
                <input type="date" value={newLease.end_date} onChange={(e) => setNewLease({ ...newLease, end_date: e.target.value })} required />
              </div>
              <div className="field">
                <label>Monthly rent (KES) *</label>
                <input type="number" min="0" value={newLease.monthly_rent} onChange={(e) => setNewLease({ ...newLease, monthly_rent: e.target.value })} required />
              </div>
            </div>
            <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
              <button type="button" className="btn secondary" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="btn">Create tenancy</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit lease — ${editing.unit_number} (${editing.tenant_name})`} onClose={() => setEditing(null)}>
          {err && <div className="error-banner">{err}</div>}
          <form onSubmit={saveEdit}>
            <div className="form-grid">
              <div className="field">
                <label>Start date</label>
                <input type="date" value={editLease.start_date} onChange={(e) => setEditLease({ ...editLease, start_date: e.target.value })} />
              </div>
              <div className="field">
                <label>End date</label>
                <input type="date" value={editLease.end_date} onChange={(e) => setEditLease({ ...editLease, end_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Monthly rent (KES)</label>
                <input type="number" min="0" value={editLease.monthly_rent} onChange={(e) => setEditLease({ ...editLease, monthly_rent: e.target.value })} />
              </div>
            </div>
            <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
              <button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn">Save changes</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmTerminate && (
        <Modal title="Terminate lease" onClose={() => setConfirmTerminate(null)}>
          <p>End the lease for <strong>{confirmTerminate.unit_number}</strong> ({confirmTerminate.tenant_name})? The unit will be marked <strong>vacant</strong>.</p>
          <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
            <button className="btn secondary" onClick={() => setConfirmTerminate(null)}>Cancel</button>
            <button className="btn danger" onClick={terminate} disabled={busy === 'terminate'}>Terminate</button>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDelete
          title="Delete lease"
          message={<p>Permanently delete the lease for <strong>{confirmDel.unit_number}</strong> ({confirmDel.tenant_name})? The unit will be marked <strong>vacant</strong>.</p>}
          onConfirm={removeLease}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

function LeaseRow({ l, busy, onNotice, onEdit, onDelete, showRenew = true, onRenew }) {
  return (
    <tr>
      <td>{l.property_name}</td><td><strong>{l.unit_number}</strong></td>
      <td>{l.tenant_name}</td><td className="small muted">{l.phone}</td>
      <td className="num">{ksh(l.monthly_rent)}</td>
      <td className="small">{fmtDate(l.start_date)}</td>
      <td className="small">{fmtDate(l.end_date)}</td>
      <td>{badgeFor(l.days_left)}</td>
      <td>{l.notice_sent ? <span className="badge ok">sent</span> : <span className="badge neutral">not sent</span>}</td>
      <td>
        <div className="inline-chips">
          {!l.notice_sent && <button className="btn small secondary" onClick={() => onNotice(l)}>Send notice</button>}
          <button className="btn small secondary" onClick={() => onEdit(l)}>Edit</button>
          {showRenew && <button className="btn small" disabled={busy === 'renew' + l.id} onClick={() => onRenew(l)}>{busy === 'renew' + l.id ? '…' : 'Renew +10%'}</button>}
          <button className="btn small danger" onClick={() => onDelete(l)}>Del</button>
        </div>
      </td>
    </tr>
  )
}

function RenewalTable({ rows, busy, onNotice, onRenew, onEdit, onTerminate, onDelete }) {
  if (rows.length === 0) return <p className="muted">None.</p>
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr><th>Property</th><th>Unit</th><th>Tenant</th><th>Phone</th><th className="num">Current rent</th>
            <th>End date</th><th>Time left</th><th>Notice</th><th className="num">New rent (+10%)</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td data-label="Property">{l.property_name}</td><td data-label="Unit"><strong>{l.unit_number}</strong></td>
              <td data-label="Tenant">{l.tenant_name}</td><td data-label="Phone" className="small muted">{l.phone}</td>
              <td data-label="Current rent" className="num">{ksh(l.monthly_rent)}</td>
              <td data-label="End date" className="small">{fmtDate(l.end_date)}</td>
              <td data-label="Time left">{badgeFor(l.days_left)}</td>
              <td data-label="Notice">{l.notice_sent ? <span className="badge ok">sent</span> : <span className="badge warn">pending</span>}</td>
              <td data-label="New rent (+10%)" className="num"><strong>{ksh(l.new_rent_10pct)}</strong></td>
              <td data-label="" style={{ whiteSpace: 'nowrap' }}>
                <div className="inline-chips">
                  {!l.notice_sent && <button className="btn small secondary" disabled={busy === 'notice' + l.id} onClick={() => onNotice(l)}>Send notice</button>}
                  <button className="btn small secondary" onClick={() => onEdit(l)}>Edit</button>
                  <button className="btn small" disabled={busy === 'renew' + l.id} onClick={() => onRenew(l)}>{busy === 'renew' + l.id ? '…' : 'Renew +10%'}</button>
                  <button className="btn small danger" onClick={() => onTerminate(l)}>End</button>
                  <button className="btn small danger" onClick={() => onDelete(l)}>Del</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}