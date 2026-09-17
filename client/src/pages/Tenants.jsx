import { useEffect, useState } from 'react'
import { api, useResource } from '../api.js'
import Modal from '../components/Modal.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'
import Paginator, { usePagination } from '../components/Paginator.jsx'

export default function Tenants() {
  const { data: tenants, loading, error, refresh } = useResource('/api/tenants')
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const shown = (tenants || []).filter((t) => {
    if (filterStatus === 'active' && !t.active_leases) return false
    if (filterStatus === 'inactive' && t.active_leases > 0) return false
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!`${t.name} ${t.phone || ''} ${t.email || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const { page, setPage, totalItems, totalPages, pageItems } = usePagination(shown, 20)
  useEffect(() => setPage(1), [filterText, filterStatus])

  function openAdd() { setForm({ name: '', phone: '', email: '' }); setAdding(true) }
  function openEdit(t) { setForm({ name: t.name, phone: t.phone || '', email: t.email || '' }); setEditing(t) }

  async function save(e) {
    e.preventDefault()
    setErr(''); setMsg('')
    try {
      if (editing) {
        await api.patch(`/api/tenants/${editing.id}`, form)
        setMsg(`Tenant "${form.name}" updated`)
      } else {
        await api.post('/api/tenants', form)
        setMsg(`Tenant "${form.name}" added`)
      }
      setAdding(false); setEditing(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function remove(reason) {
    setErr(''); setMsg('')
    try {
      await api.del(`/api/tenants/${confirmDel.id}`, { reason })
      setMsg(`Tenant ${confirmDel.name} deleted`)
      setConfirmDel(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Tenants</h2>
          <p>Everyone renting on the estate</p>
        </div>
        <button className="btn" onClick={openAdd}>+ Add tenant</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}
      {loading && <div className="loading">Loading tenants…</div>}

      {(adding || editing) && (
        <Modal title={editing ? `Edit: ${editing.name}` : 'Add tenant'} onClose={() => { setAdding(false); setEditing(null) }}>
          {err && <div className="error-banner">{err}</div>}
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Full name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07…" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
              <button type="button" className="btn secondary" onClick={() => { setAdding(false); setEditing(null) }}>Cancel</button>
              <button type="submit" className="btn">{editing ? 'Save changes' : 'Add tenant'}</button>
            </div>
          </form>
        </Modal>
      )}

      {tenants && (
        <div className="card">
          <div className="card-title">
            <h3>All tenants <span className="muted">({shown.length})</span></h3>
            <div className="filters">
              <input className="inp" placeholder="Search name / phone / email…" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All tenants</option>
                <option value="active">Has active lease</option>
                <option value="inactive">No active lease</option>
              </select>
              {(filterText || filterStatus) && (
                <button className="btn small secondary" onClick={() => { setFilterText(''); setFilterStatus('') }}>Clear</button>
              )}
            </div>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Email</th><th className="num">Active leases</th><th className="num">Total leases</th><th></th></tr>
              </thead>
              <tbody>
                {pageItems.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Name"><strong>{t.name}</strong></td>
                    <td data-label="Phone">{t.phone || '—'}</td>
                    <td data-label="Email" className="muted">{t.email || '—'}</td>
                    <td data-label="Active leases" className="num">{t.active_leases > 0 ? <span className="badge ok">{t.active_leases}</span> : <span className="muted">0</span>}</td>
                    <td data-label="Total leases" className="num">{t.total_leases}</td>
                    <td data-label="">
                      <div className="inline-chips">
                        <button className="btn small secondary" onClick={() => openEdit(t)}>Edit</button>
                        <button className="btn small danger" disabled={t.total_leases > 0} title={t.total_leases > 0 ? 'Has linked leases' : ''} onClick={() => setConfirmDel(t)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td data-label="Name" colSpan="6" className="muted">No tenants match your filters.</td></tr>}
              </tbody>
            </table>
            <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
          </div>
        </div>
      )}

      {confirmDel && (
        <ConfirmDelete
          title="Delete tenant"
          message={<p>Delete <strong>{confirmDel.name}</strong>?</p>}
          onConfirm={remove}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}