import { useState } from 'react'
import { api, useResource } from '../api.js'
import Modal from '../components/Modal.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'

const empty = { name: '', location: '' }

export default function Properties() {
  const { data: props, loading, error, refresh } = useResource('/api/properties')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const shown = (props || []).filter((p) => {
    if (filterStatus === 'vacancies' && p.occupied_count >= p.unit_count) return false
    if (filterStatus === 'full' && p.occupied_count < p.unit_count) return false
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!`${p.name} ${p.location || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  function openAdd() { setForm(empty); setAdding(true) }
  function openEdit(p) { setForm({ name: p.name, location: p.location || '' }); setEditing(p) }

  async function save(e) {
    e.preventDefault()
    setErr(''); setMsg('')
    try {
      if (editing) {
        await api.patch(`/api/properties/${editing.id}`, form)
        setMsg(`Property "${form.name}" updated`)
      } else {
        await api.post('/api/properties', form)
        setMsg(`Property "${form.name}" added`)
      }
      setAdding(false); setEditing(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function remove(reason) {
    setErr('')
    try {
      await api.del(`/api/properties/${confirmDel.id}`, { reason })
      setMsg(`"${confirmDel.name}" deleted (its units and records were removed)`)
      setConfirmDel(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  const modalOpen = adding || editing
  const modalTitle = editing ? `Edit: ${editing.name}` : 'Add property'

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Properties</h2>
          <p>Manage buildings and their units</p>
        </div>
        <button className="btn" onClick={openAdd}>+ Add property</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}
      {loading && <div className="loading">Loading properties…</div>}

      {props && (
        <div className="card">
          <div className="card-title">
            <h3>All properties <span className="muted">({shown.length})</span></h3>
            <div className="filters">
              <input className="inp" placeholder="Search property / location…" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All</option>
                <option value="vacancies">Has vacancies</option>
                <option value="full">Fully occupied</option>
              </select>
              {(filterText || filterStatus) && (
                <button className="btn small secondary" onClick={() => { setFilterText(''); setFilterStatus('') }}>Clear</button>
              )}
            </div>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Location</th><th className="num">Units</th><th className="num">Occupied</th><th className="num">Vacant</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Name"><strong>{p.name}</strong></td>
                    <td data-label="Location" className="muted">{p.location || '—'}</td>
                    <td data-label="Units" className="num">{p.unit_count}</td>
                    <td data-label="Occupied" className="num"><span className="badge ok">{p.occupied_count}</span></td>
                    <td data-label="Vacant" className="num"><span className="badge neutral">{p.unit_count - p.occupied_count}</span></td>
                    <td data-label="">
                      <div className="inline-chips">
                        <button className="btn small secondary" onClick={() => openEdit(p)}>Edit</button>
                        <button className="btn small danger" onClick={() => setConfirmDel(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td data-label="Name" colSpan="6" className="muted">No properties match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <Modal title={modalTitle} onClose={() => { setAdding(false); setEditing(null) }}>
          {err && <div className="error-banner">{err}</div>}
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Melon Park" autoFocus />
              </div>
              <div className="field">
                <label>Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Eldoret" />
              </div>
            </div>
            {editing && (
              <p className="muted small" style={{ marginTop: 10 }}>
                Warning: deleting this property removes all its <strong>units, leases, payments and meter readings</strong>.
              </p>
            )}
            <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
              <button type="button" className="btn secondary" onClick={() => { setAdding(false); setEditing(null) }}>Cancel</button>
              <button type="submit" className="btn">{editing ? 'Save changes' : 'Add property'}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDelete
          title="Delete property"
          message={(
            <div>
              <p>
                Delete <strong>{confirmDel.name}</strong> ({confirmDel.unit_count} units)?
              </p>
              <p className="muted small" style={{ marginTop: 8 }}>
                This permanently removes the property and all linked units, leases, payments and utility readings.
              </p>
            </div>
          )}
          onConfirm={remove}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}