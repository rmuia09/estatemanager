import { useState } from 'react'
import { api, useResource } from '../api.js'
import { ksh, fmtDate } from '../format.js'
import Modal from '../components/Modal.jsx'
import ReceivePayment from '../components/ReceivePayment.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'
import OnboardingModal from '../components/OnboardingModal.jsx'

const empty = { property_id: '', unit_number: '', unit_type: 'apartment', monthly_rent: '', status: 'vacant' }

export default function Units() {
  const { data: units, loading, error, refresh } = useResource('/api/units')
  const { data: props } = useResource('/api/properties')
  const [form, setForm] = useState(empty)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [payUnit, setPayUnit] = useState(null)
  const [occupy, setOccupy] = useState(null)
  const [vacate, setVacate] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [filterProp, setFilterProp] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  function openAdd() { setForm(empty); setAdding(true) }
  function openEdit(u) { setForm({ property_id: u.property_id, unit_number: u.unit_number, unit_type: u.unit_type, monthly_rent: u.monthly_rent, status: u.status }); setEditing(u) }

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value })
  }

  async function save(e) {
    e.preventDefault()
    setErr(''); setMsg('')
    try {
      if (editing) {
        await api.patch(`/api/units/${editing.id}`, { ...form, monthly_rent: Number(form.monthly_rent) })
        setMsg(`Unit ${form.unit_number} updated`)
      } else {
        await api.post('/api/units', { ...form, monthly_rent: Number(form.monthly_rent) })
        setMsg(`Unit ${form.unit_number} added`)
      }
      setAdding(false); setEditing(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function remove(reason) {
    setErr(''); setMsg('')
    try {
      await api.del(`/api/units/${confirmDel.id}`, { reason })
      setMsg(`Unit ${confirmDel.unit_number} deleted`)
      setConfirmDel(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function doVacate(reason) {
    const r = await api.post(`/api/units/${vacate.id}/vacate`, { reason })
    setMsg(`Unit ${vacate.unit_number} marked vacant${r.leases_ended ? ` and ${r.leases_ended} lease(s) ended` : ''}`)
    setVacate(null)
    refresh()
  }

  const shown = (units || []).filter((u) => {
    if (filterProp && u.property_name !== filterProp) return false
    if (filterStatus && u.status !== filterStatus) return false
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!`${u.unit_number} ${u.tenant_name || ''} ${u.tenant_phone || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Units</h2>
          <p>Track units, tenants and rent across the estate</p>
        </div>
        <button className="btn" onClick={openAdd}>+ Add unit</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}

      {props && (
        <div className="inline-chips" style={{ marginBottom: 16 }}>
          {props.map((p) => (
            <span key={p.id} className="badge neutral">{p.name}: {p.occupied_count}/{p.unit_count}</span>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h3>All units <span className="muted">({shown.length})</span></h3>
          <div className="filters">
            <input className="inp" placeholder="Search unit / tenant / phone…" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
            <select value={filterProp} onChange={(e) => setFilterProp(e.target.value)}>
              <option value="">All properties</option>
              {props && props.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
            </select>
            {(filterText || filterProp || filterStatus) && (
              <button className="btn small secondary" onClick={() => { setFilterText(''); setFilterProp(''); setFilterStatus('') }}>Clear</button>
            )}
          </div>
        </div>
        {loading && <div className="loading">Loading units…</div>}
        {error && <div className="error-banner">{error}</div>}
        {units && (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Property</th><th>Unit</th><th>Type</th><th>Tenant</th><th>Contact</th>
                  <th className="num">Rent / mo</th><th>Lease end</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Property">{u.property_name}</td>
                    <td data-label="Unit"><strong>{u.unit_number}</strong></td>
                    <td data-label="Type" className="muted">{u.unit_type}</td>
                    <td data-label="Tenant">{u.tenant_name || <span className="muted">—</span>}</td>
                    <td data-label="Contact" className="muted small">{u.tenant_phone || '—'}</td>
                    <td data-label="Rent / mo" className="num">{ksh(u.monthly_rent)}</td>
                    <td data-label="Lease end" className="small">{u.lease_end ? fmtDate(u.lease_end) : '—'}</td>
                    <td data-label="Status"><span className={`badge ${u.status === 'occupied' ? 'ok' : 'neutral'}`}>{u.status}</span></td>
                    <td data-label="">
                      <div className="inline-chips">
                        {u.status === 'occupied' ? (
                          <>
                            <button className="btn small secondary" onClick={() => setPayUnit(u.id)}>Receive</button>
                            <button className="btn small warn" title="End lease and mark vacant" onClick={() => setVacate(u)}>Vacate</button>
                          </>
                        ) : (
                          <button className="btn small ok" title="Onboard a tenant into this unit" onClick={() => setOccupy(u)}>Occupy</button>
                        )}
                        <button className="btn small secondary" onClick={() => openEdit(u)}>Edit</button>
                        <button className="btn small danger" onClick={() => setConfirmDel(u)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td data-label="Property" colSpan="9" className="muted">No units match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(adding || editing) && (
        <Modal title={editing ? `Edit unit ${editing.unit_number}` : 'Add unit'} onClose={() => { setAdding(false); setEditing(null) }}>
          {err && <div className="error-banner">{err}</div>}
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Property *</label>
                <select value={form.property_id} onChange={set('property_id')} required>
                  <option value="">Select property…</option>
                  {props && props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Unit number *</label>
                <input value={form.unit_number} onChange={set('unit_number')} required placeholder="e.g. E1" />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.unit_type} onChange={set('unit_type')}>
                  <option value="apartment">Apartment</option>
                  <option value="bedsitter">Bedsitter</option>
                  <option value="house">House</option>
                  <option value="shop">Shop</option>
                </select>
              </div>
              <div className="field">
                <label>Monthly rent (KES)</label>
                <input type="number" min="0" value={form.monthly_rent} onChange={set('monthly_rent')} placeholder="0" />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={set('status')}>
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                </select>
              </div>
            </div>
            <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent', marginTop: 8 }}>
              <button type="button" className="btn secondary" onClick={() => { setAdding(false); setEditing(null) }}>Cancel</button>
              <button type="submit" className="btn">{editing ? 'Save changes' : 'Save unit'}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDelete
          title="Delete unit"
          message={(
            <div>
              <p>Delete unit <strong>{confirmDel.unit_number}</strong> ({confirmDel.property_name})?</p>
              <p className="muted small" style={{ marginTop: 8 }}>
                This permanently removes the unit and all its linked leases, payments and meter readings.
              </p>
            </div>
          )}
          onConfirm={remove}
          onClose={() => setConfirmDel(null)}
        />
      )}

      {payUnit && <ReceivePayment unitId={payUnit} onClose={() => setPayUnit(null)} onDone={() => { setPayUnit(null); setMsg('Payment recorded'); setTimeout(() => setMsg(''), 4000) }} />}

      {occupy && (
        <OnboardingModal
          unitId={occupy.id}
          onClose={() => setOccupy(null)}
          onDone={(r) => {
            setOccupy(null)
            setMsg(`Unit ${r.unit_number} occupied — tenancy for ${r.unit_number} created (renews every ${r.renewal_months} month(s))`)
            refresh()
            setTimeout(() => setMsg(''), 6000)
          }}
        />
      )}

      {vacate && (
        <ConfirmDelete
          title="Vacate unit"
          confirmLabel="End lease & mark vacant"
          message={(
            <div>
              <p>Mark <strong>{vacate.unit_number}</strong> ({vacate.property_name}) as vacant and end its active lease?</p>
              <p className="muted small" style={{ marginTop: 8 }}>
                The tenant and payment history stay on record; the lease is marked <strong>terminated</strong> so
                occupancy and leases stay consistent. This action is logged in the audit trail.
              </p>
            </div>
          )}
          onConfirm={doVacate}
          onClose={() => setVacate(null)}
        />
      )}
    </div>
  )
}