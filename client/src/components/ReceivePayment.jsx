import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { todayStr, currentMonth } from '../format.js'
import Modal from './Modal.jsx'

export default function ReceivePayment({ unitId, onDone, onClose }) {
  const [units, setUnits] = useState([])
  const [unit, setUnit] = useState(unitId || '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [period, setPeriod] = useState(currentMonth())
  const [method, setMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/api/units').then((u) => {
      setUnits(u)
      if (unitId) {
        const found = u.find((x) => x.id === Number(unitId))
        if (found) { setAmount(found.monthly_rent); setPeriod(currentMonth()) }
      }
    }).catch((e) => setError(e.message))
  }, [unitId])

  function handleUnit(id) {
    setUnit(id)
    const u = units.find((x) => x.id === Number(id))
    if (u) { setAmount(u.monthly_rent); setPeriod(currentMonth()) }
  }

  async function submit(e) {
    e.preventDefault()
    if (!unit) return
    setBusy(true); setError('')
    try {
      await api.post('/api/payments', {
        unit_id: Number(unit),
        amount: Number(amount),
        payment_date: date,
        period: period || date.slice(0, 7),
        method,
        notes
      })
      onDone && onDone()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const selUnit = units.find((x) => x.id === Number(unit))

  return (
    <Modal title="Receive rent payment" onClose={onClose}>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>Unit *</label>
            <select value={unit} onChange={(e) => handleUnit(e.target.value)} required>
              <option value="">Select unit…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.property_name} · {u.unit_number}{u.tenant_name ? ` (${u.tenant_name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Tenant</label>
            <input value={selUnit ? (selUnit.tenant_name || '—') : ''} readOnly tabIndex={-1} />
          </div>
          <div className="field">
            <label>Amount (KES) *</label>
            <input type="number" min="0" step="10" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="e.g. 2500" />
          </div>
          <div className="field">
            <label>Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Period (month) </label>
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="field">
            <label>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="bank">Bank</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          </div>
        </div>
        <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy || !unit}> {busy ? 'Saving…' : 'Save payment'}</button>
        </div>
      </form>
    </Modal>
  )
}