import { useEffect, useState } from 'react'
import { api, useResource } from '../api.js'
import { ksh2, fmtDate, todayStr } from '../format.js'
import Modal from '../components/Modal.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'
import Paginator, { usePagination } from '../components/Paginator.jsx'

export default function Utilities() {
  const { data: units } = useResource('/api/units')
  const { data: readings, loading, error, refresh } = useResource('/api/readings')
  const { data: rates, refresh: refreshRates } = useResource('/api/utility/rates')

  const [utility, setUtility] = useState('water')
  const [unitId, setUnitId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [current, setCurrent] = useState('')
  const [rate, setRate] = useState('')
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [rateWater, setRateWater] = useState('')
  const [rateElec, setRateElec] = useState('')
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const [editForm, setEditForm] = useState({ rate_per_unit: '', notes: '', status: 'pending' })
  const [filterText, setFilterText] = useState('')
  const [filterUtility, setFilterUtility] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProp, setFilterProp] = useState('')

  const propertyList = (units || []).map((u) => u.property_name).filter((v, i, a) => a.indexOf(v) === i)

  const shownReadings = (readings || []).filter((r) => {
    if (filterUtility && r.utility !== filterUtility) return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterProp && r.property_name !== filterProp) return false
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!`${r.unit_number} ${r.property_name || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const { page, setPage, totalItems, totalPages, pageItems } = usePagination(shownReadings, 20)
  useEffect(() => setPage(1), [filterText, filterProp, filterUtility, filterStatus])

  useEffect(() => {
    if (rates) { setRateWater(rates.water); setRateElec(rates.electricity); if (!rate) setRate(rates.water) }
  }, [rates])

  useEffect(() => { if (rates) setRate(utility === 'water' ? rates.water : rates.electricity) }, [utility, rates])

  const prevReading = unitId
    ? (readings || []).find((r) => r.unit_id === Number(unitId) && r.utility === utility)
    : null

  const consumption = current !== '' ? Math.round((Number(current) - (prevReading ? prevReading.current_reading : 0)) * 100) / 100 : null
  const amount = consumption != null && rate !== '' ? Math.round(consumption * Number(rate) * 100) / 100 : null

  async function saveReading(e) {
    e.preventDefault()
    if (!unitId || current === '') return
    setBusy(true); setErr('')
    try {
      const r = await api.post('/api/readings', {
        unit_id: Number(unitId), utility, reading_date: date,
        current_reading: Number(current), rate_per_unit: Number(rate), notes
      })
      setMsg(`${utility} reading saved → used ${r.consumption} units · ${ksh2(r.amount)}`)
      setCurrent(''); setNotes('')
      refresh()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  async function saveRates() {
    setErr('')
    try {
      await api.put('/api/utility/rates', { water: Number(rateWater), electricity: Number(rateElec) })
      refreshRates()
      setMsg('Utility rates updated')
    } catch (x) { setErr(x.message) }
  }

  async function setStatus(r, status) {
    try {
      await api.patch(`/api/readings/${r.id}`, { status })
      refresh()
    } catch (x) { setErr(x.message) }
  }

  function openEdit(r) {
    setEditForm({ rate_per_unit: r.rate_per_unit, notes: r.notes || '', status: r.status })
    setEditing(r)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setErr('')
    try {
      await api.patch(`/api/readings/${editing.id}`, { ...editForm, rate_per_unit: Number(editForm.rate_per_unit) })
      setEditing(null)
      setMsg('Reading updated')
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function removeReading(reason) {
    setErr('')
    try {
      await api.del(`/api/readings/${del.id}`, { reason })
      setDel(null)
      setMsg('Reading deleted')
      refresh()
    } catch (x) { setErr(x.message) }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Water &amp; electricity bills</h2>
          <p>Enter current meter readings; consumption and bill are computed from the previous reading</p>
        </div>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}

      <div className="card">
        <div className="card-title">
          <h3>New meter reading</h3>
        </div>
        <form onSubmit={saveReading}>
          <div className="form-grid">
            <div className="field">
              <label>Utility *</label>
              <select value={utility} onChange={(e) => setUtility(e.target.value)}>
                <option value="water">💧 Water</option>
                <option value="electricity">⚡ Electricity</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Unit *</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
                <option value="">Select unit…</option>
                {units && units.map((u) => <option key={u.id} value={u.id}>{u.property_name} · {u.unit_number}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Reading date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Current reading (units) *</label>
              <input type="number" min="0" step="any" value={current} onChange={(e) => setCurrent(e.target.value)} required
                placeholder={prevReading ? `previous ${prevReading.current_reading}` : 'first reading'} />
            </div>
            <div className="field">
              <label>Rate per unit (KES)</label>
              <input type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
            </div>
          </div>

          <div className="preview-box" style={{ marginTop: 14 }}>
            <div>Previous reading: <strong>{prevReading ? prevReading.current_reading : '—'} {utility === 'water' ? 'm³' : 'kWh'}</strong></div>
            <div>Consumption: <strong>{consumption != null ? consumption : '—'}</strong></div>
            <div>Bill amount: <strong>{amount != null ? ksh2(amount) : '—'}</strong></div>
          </div>

          <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
            <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save reading'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Utility rates</h3>
          <div className="rate-pills">
            <div className="field">
              <label>Water (per m³)</label>
              <input type="number" min="0" style={{ width: 110 }} value={rateWater} onChange={(e) => setRateWater(e.target.value)} />
            </div>
            <div className="field">
              <label>Electricity (per kWh)</label>
              <input type="number" min="0" style={{ width: 110 }} value={rateElec} onChange={(e) => setRateElec(e.target.value)} />
            </div>
            <button className="btn secondary" onClick={saveRates}>Save rates</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Readings history <span className="muted">({shownReadings.length})</span></h3>
          <div className="filters" style={{ gridColumn: '1 / -1' }}>
            <input className="inp" placeholder="Search unit / property…" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
            <select value={filterProp} onChange={(e) => setFilterProp(e.target.value)}>
              <option value="">All properties</option>
              {propertyList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterUtility} onChange={(e) => setFilterUtility(e.target.value)}>
              <option value="">All utilities</option>
              <option value="water">Water</option>
              <option value="electricity">Electricity</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
            {(filterText || filterProp || filterUtility || filterStatus) && (
              <button className="btn small secondary" onClick={() => { setFilterText(''); setFilterProp(''); setFilterUtility(''); setFilterStatus('') }}>Clear</button>
            )}
          </div>
        </div>
        {loading && <div className="loading">Loading readings…</div>}
        {error && <div className="error-banner">{error}</div>}
        {shownReadings.length === 0 && !loading && <p className="empty">No readings match your filters.</p>}
        {shownReadings.length > 0 && (
          <>
          <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Property</th><th>Unit</th><th>Utility</th>
                  <th className="num">Previous</th><th className="num">Current</th><th className="num">Used</th>
                  <th className="num">Rate</th><th className="num">Amount</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {pageItems.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Date">{fmtDate(r.reading_date)}</td>
                    <td data-label="Property">{r.property_name}</td><td data-label="Unit">{r.unit_number}</td>
                    <td data-label="Utility">{r.utility === 'water' ? '💧 Water' : '⚡ Electricity'}</td>
                    <td data-label="Previous" className="num small">{r.previous_reading}</td>
                    <td data-label="Current" className="num small">{r.current_reading}</td>
                    <td data-label="Used" className="num small">{r.consumption}</td>
                    <td data-label="Rate" className="num small">{r.rate_per_unit}</td>
                    <td data-label="Amount" className="num">{ksh2(r.amount)}</td>
                    <td data-label="Status"><span className={`badge ${r.status === 'paid' ? 'ok' : 'warn'}`}>{r.status}</span></td>
                    <td data-label="">
                      <div className="inline-chips">
                        {r.status === 'pending' && <button className="btn small secondary" onClick={() => setStatus(r, 'paid')}>Mark paid</button>}
                        <button className="btn small secondary" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn small danger" onClick={() => setDel(r)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
          </div>
          </>
        )}
      </div>

      {editing && (
        <Modal title={`Edit reading — ${editing.unit_number} (${editing.utility})`} onClose={() => setEditing(null)}>
          {err && <div className="error-banner">{err}</div>}
          <form onSubmit={saveEdit}>
            <div className="form-grid">
              <div className="field">
                <label>Rate per unit (KES)</label>
                <input type="number" min="0" step="any" value={editForm.rate_per_unit} onChange={(e) => setEditForm({ ...editForm, rate_per_unit: e.target.value })} required />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>
              Consumption: {editing.consumption} · amount recalculated: {ksh2(editing.consumption * (Number(editForm.rate_per_unit) || 0))}
            </p>
            <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
              <button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn">Save changes</button>
            </div>
          </form>
        </Modal>
      )}

      {del && (
        <ConfirmDelete
          title="Delete reading"
          confirmLabel="Delete reading"
          message={(
            <div>
              <p>Delete the {del.utility} reading for <strong>{del.unit_number}</strong> from {fmtDate(del.reading_date)} ({ksh2(del.amount)})?</p>
              <p className="muted small" style={{ marginTop: 8 }}>The meter consumption history for this period will be removed.</p>
            </div>
          )}
          onConfirm={removeReading}
          onClose={() => setDel(null)}
        />
      )}
    </div>
  )
}