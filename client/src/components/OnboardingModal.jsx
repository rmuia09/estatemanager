import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { todayStr } from '../format.js'
import Modal from './Modal.jsx'

export default function OnboardingModal({ unitId, onDone, onClose }) {
  const [units, setUnits] = useState([])
  const [props, setProps] = useState([])
  const [form, setForm] = useState({
    unit_id: unitId || '',
    createNew: false,
    property_id: '',
    unit_number: '',
    unit_type: 'apartment',
    name: '',
    phone: '',
    email: '',
    start_date: todayStr(),
    duration_months: 12,
    monthly_rent: '',
    renewal_months: 12
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/api/units').then((u) => {
      setUnits(u)
      if (unitId) {
        const found = u.find((x) => x.id === Number(unitId))
        if (found) setForm((f) => ({ ...f, unit_id: unitId, monthly_rent: found.monthly_rent }))
      }
    }).catch((e) => setErr(e.message))
    api.get('/api/properties').then(setProps).catch(() => {})
  }, [unitId])

  function pickUnit(id) {
    setForm((f) => ({ ...f, unit_id: id, monthly_rent: id ? (units.find((u) => u.id === Number(id)) || {}).monthly_rent || '' : '' }))
  }

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value })
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const payload = {
        unit_id: form.createNew ? undefined : (form.unit_id ? Number(form.unit_id) : undefined),
        property_id: form.createNew ? Number(form.property_id) || undefined : undefined,
        unit_number: form.createNew ? form.unit_number : undefined,
        unit_type: form.createNew ? form.unit_type : undefined,
        tenant: { name: form.name, phone: form.phone, email: form.email },
        start_date: form.start_date,
        duration_months: Number(form.duration_months),
        monthly_rent: Number(form.monthly_rent),
        renewal_months: Number(form.renewal_months)
      }
      const r = await api.post('/api/onboarding', payload)
      onDone && onDone(r)
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  const vacantUnits = units.filter((u) => u.status !== 'occupied')

  return (
    <Modal title={unitId ? `Occupy unit — ${(units.find((u) => u.id === Number(unitId)) || {}).unit_number || ''}` : 'Onboard a new tenant'} wide onClose={onClose}>
      {err && <div className="error-banner">{err}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Assign</label>
            <label className="switch-row">
              <span className="switch">
                <input type="checkbox" checked={form.createNew} onChange={(e) => setForm({ ...form, createNew: e.target.checked })} />
                <span className="slider" />
              </span>
              <span className="small">{form.createNew ? 'Create a new unit for this tenant' : 'Use an existing vacant unit'}</span>
            </label>
          </div>

          {!form.createNew && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>House / unit *</label>
              <select value={form.unit_id} onChange={(e) => pickUnit(e.target.value)} required={!form.createNew}>
                <option value="">Select a vacant unit…</option>
                {vacantUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.property_name} · {u.unit_number} — {u.monthly_rent ? `KSh ${u.monthly_rent}/mo` : 'set rent below'}</option>
                ))}
                {vacantUnits.length === 0 && <option disabled>No vacant units — check “Create a new unit”</option>}
              </select>
            </div>
          )}

          {form.createNew && (
            <>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Property *</label>
                <select value={form.property_id} onChange={set('property_id')} required={form.createNew}>
                  <option value="">Select property…</option>
                  {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>New unit number *</label>
                <input value={form.unit_number} onChange={set('unit_number')} placeholder="e.g. E1" required={form.createNew} />
              </div>
              <div className="field">
                <label>Unit type</label>
                <select value={form.unit_type} onChange={set('unit_type')}>
                  <option value="apartment">Apartment</option>
                  <option value="bedsitter">Bedsitter</option>
                  <option value="house">House</option>
                  <option value="shop">Shop</option>
                </select>
              </div>
            </>
          )}

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Tenant full name *</label>
            <input value={form.name} onChange={set('name')} required autoFocus placeholder="e.g. Jane Wanjiku" />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={set('phone')} placeholder="07…" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" />
          </div>
          <div className="field">
            <label>Date of joining *</label>
            <input type="date" value={form.start_date} onChange={set('start_date')} required />
          </div>
          <div className="field">
            <label>Lease duration (months) *</label>
            <input type="number" min="1" value={form.duration_months} onChange={set('duration_months')} required />
          </div>
          <div className="field">
            <label>Initial rent (KES/mo) *</label>
            <input type="number" min="0" value={form.monthly_rent} onChange={set('monthly_rent')} required placeholder="e.g. 2500" />
          </div>
          <div className="field">
            <label>Renewal frequency (months) *</label>
            <input type="number" min="1" value={form.renewal_months} onChange={set('renewal_months')} required />
            <span className="hint">Lease renews every N months; reminders are sent automatically before expiry.</span>
          </div>
        </div>
        <div className="preview-box" style={{ marginTop: 14 }}>
          <div>Duration: <strong>{form.duration_months || '—'} month(s)</strong></div>
          <div>Rent: <strong>KSh {form.monthly_rent ? Number(form.monthly_rent).toLocaleString() : '—'}/mo</strong></div>
          <div>Renews every: <strong>{form.renewal_months || '—'} month(s)</strong></div>
        </div>
        <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn ok" disabled={busy}>{busy ? 'Onboarding…' : 'Occupied — save tenancy'}</button>
        </div>
      </form>
    </Modal>
  )
}