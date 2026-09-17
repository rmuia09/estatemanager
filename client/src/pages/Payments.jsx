import { useEffect, useMemo, useState } from 'react'
import { api, useResource } from '../api.js'
import { ksh, fmtDate, currentMonth } from '../format.js'
import Modal from '../components/Modal.jsx'
import ReceivePayment from '../components/ReceivePayment.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'
import Paginator, { usePagination } from '../components/Paginator.jsx'

const fmtMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })
}

export default function Payments() {
  const { data: units } = useResource('/api/units')
  const { data: tenants } = useResource('/api/tenants')
  const { data: props } = useResource('/api/properties')
  const { data: payments, loading, error, refresh } = useResource('/api/payments?limit=500')

  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // filters
  const [fText, setFText] = useState('')
  const [fProp, setFProp] = useState('')
  const [fUnit, setFUnit] = useState('')
  const [fTenant, setFTenant] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  // ledger
  const [ledger, setLedger] = useState(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [lFrom, setLFrom] = useState(() => currentMonth())
  const [lTo, setLTo] = useState(() => currentMonth())
  const [lProp, setLProp] = useState('')
  const [lSearch, setLSearch] = useState('')

  const [form, setForm] = useState({ amount: '', payment_date: '', period: '', method: 'cash', notes: '' })

  const shown = useMemo(() => {
    if (!payments) return []
    return payments.filter((p) => {
      if (fText) {
        const q = fText.toLowerCase()
        if (!`${p.unit_number} ${p.tenant_name || ''} ${p.property_name}`.toLowerCase().includes(q)) return false
      }
      if (fProp && p.property_name !== fProp) return false
      if (fUnit && p.unit_id !== Number(fUnit)) return false
      if (fTenant && p.tenant_id !== Number(fTenant)) return false
      if (fFrom && p.payment_date < fFrom) return false
      if (fTo && p.payment_date > fTo) return false
      return true
    })
  }, [payments, fText, fProp, fUnit, fTenant, fFrom, fTo])

  const total = shown.reduce((s, p) => s + p.amount, 0)

  const { page, setPage, totalItems, totalPages, pageItems } = usePagination(shown, 20)
  useEffect(() => setPage(1), [fText, fProp, fUnit, fTenant, fFrom, fTo])

  function openEdit(p) {
    setForm({ amount: p.amount, payment_date: p.payment_date, period: p.period, method: p.method, notes: p.notes || '' })
    setEditing(p)
  }

  async function save(e) {
    e.preventDefault()
    setErr('')
    try {
      await api.patch(`/api/payments/${editing.id}`, { ...form, amount: Number(form.amount) })
      setEditing(null)
      setMsg('Payment updated')
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function remove(reason) {
    setErr('')
    try {
      await api.del(`/api/payments/${confirmDel.id}`, { reason })
      setConfirmDel(null)
      setMsg('Payment deleted')
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function loadLedger() {
    setLedgerLoading(true); setErr('')
    try {
      const q = new URLSearchParams({ from: lFrom, to: lTo })
      if (lProp) q.set('property_id', lProp)
      setLedger(await api.get(`/api/reports/rent-ledger?${q}`))
    } catch (x) { setErr(x.message) } finally { setLedgerLoading(false) }
  }

  const ledgerRows = useMemo(() => {
    if (!ledger) return []
    const rows = []
    for (const t of ledger.tenants) {
      if (lSearch) {
        const q = lSearch.toLowerCase()
        if (!`${t.tenant_name} ${t.phone || ''}`.toLowerCase().includes(q)) continue
      }
      for (const lf of t.leases) {
        rows.push({ tenant: t, lease: lf })
      }
    }
    return rows
  }, [ledger, lSearch])

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Rent payments</h2>
          <p>Record rent, filter by date/tenant/property, and view payments per tenant per month</p>
        </div>
        <button className="btn" onClick={() => setShow(true)}>+ Receive payment</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}

      <div className="card">
        <div className="card-title">
          <h3>Payment history</h3>
          <div className="filters">
            <input className="inp" placeholder="Search unit / tenant / property…" value={fText} onChange={(e) => setFText(e.target.value)} />
            <select value={fProp} onChange={(e) => setFProp(e.target.value)}>
              <option value="">All properties</option>
              {props && props.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select value={fUnit} onChange={(e) => setFUnit(e.target.value)}>
              <option value="">All units</option>
              {units && units.map((u) => <option key={u.id} value={u.id}>{u.property_name} · {u.unit_number}</option>)}
            </select>
            <select value={fTenant} onChange={(e) => setFTenant(e.target.value)}>
              <option value="">All tenants</option>
              {tenants && tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} title="From date" />
            <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} title="To date" />
            {(fText || fProp || fUnit || fTenant || fFrom || fTo) && (
              <button className="btn small secondary" onClick={() => { setFText(''); setFProp(''); setFUnit(''); setFTenant(''); setFFrom(''); setFTo('') }}>Clear</button>
            )}
          </div>
        </div>

        {loading && <div className="loading">Loading payments…</div>}
        {!loading && error && <div className="error-banner">{error}</div>}

        {shown.length > 0 && (
          <div className="stat" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="label">Total (filtered)</div>
              <div className="value accent" style={{ fontSize: 20 }}>{ksh(total)}</div>
              <div className="muted small">{shown.length} payment(s)</div>
            </div>
          </div>
        )}
        {shown.length === 0 && !loading && <p className="empty">No payments match these filters.</p>}

        {shown.length > 0 && (
          <>
          <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Property</th><th>Unit</th><th>Tenant</th><th>Period</th>
                  <th>Method</th><th className="num">Amount</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Date">{fmtDate(p.payment_date)}</td>
                    <td data-label="Property">{p.property_name}</td>
                    <td data-label="Unit">{p.unit_number}</td>
                    <td data-label="Tenant">{p.tenant_name || '—'}</td>
                    <td data-label="Period" className="small">{p.period}</td>
                    <td data-label="Method" className="small">{p.method}</td>
                    <td data-label="Amount" className="num">{ksh(p.amount)}</td>
                    <td data-label="">
                      <div className="inline-chips">
                        <button className="btn small secondary" onClick={() => openEdit(p)}>Edit</button>
                        <button className="btn small danger" onClick={() => setConfirmDel(p)}>Del</button>
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

      <div className="card">
        <div className="card-title">
          <h3>Rent ledger — per tenant per month</h3>
          <div className="filters">
            <div className="field" style={{ margin: 0 }}>
              <label>From</label>
              <input type="month" value={lFrom} onChange={(e) => setLFrom(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>To</label>
              <input type="month" value={lTo} onChange={(e) => setLTo(e.target.value)} />
            </div>
            <select value={lProp} onChange={(e) => setLProp(e.target.value)}>
              <option value="">All properties</option>
              {props && props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="inp" placeholder="Filter tenant…" value={lSearch} onChange={(e) => setLSearch(e.target.value)} />
            <button className="btn" onClick={loadLedger} disabled={ledgerLoading}>{ledgerLoading ? 'Loading…' : 'Load ledger'}</button>
          </div>
        </div>

        {ledgerLoading && <div className="loading">Loading ledger…</div>}
        {!ledgerLoading && ledger && (
          <div>
            <p className="muted small" style={{ marginBottom: 10 }}>
              Expected rent vs paid per active lease. Outstanding = expected − paid (minimum 0).
            </p>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tenant</th><th>Unit</th><th className="num">Rent / mo</th>
                    {ledger.months.map((m) => <th key={m} className="num">{fmtMonth(m)}</th>)}
                    <th className="num">Total paid</th><th className="num">Expected</th><th className="num">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map(({ tenant, lease }, i) => (
                    <tr key={i}>
                      <td data-label="Tenant">
                        <strong>{tenant.tenant_name}</strong>
                        <div className="muted small">{tenant.phone || ''}</div>
                      </td>
                      <td data-label="Unit">{lease.unit_number}</td>
                      <td data-label="Rent / mo" className="num">{ksh(lease.monthly_rent)}</td>
                      {ledger.months.map((m) => {
                        const cell = lease.months.find((x) => x.month === m)
                        const paid = cell ? cell.paid : 0
                        const out = cell ? cell.outstanding : 0
                        return (
                          <td data-label={fmtMonth(m)} key={m} className="num">
                            {ksh(paid)}
                            {out > 0 && <div className="muted small" style={{ color: 'var(--danger)' }}>−{ksh(out)}</div>}
                          </td>
                        )
                      })}
                      <td data-label="Total paid" className="num"><strong>{ksh(lease.total_paid)}</strong></td>
                      <td data-label="Expected" className="num muted">{ksh(lease.total_expected)}</td>
                      <td data-label="Outstanding" className="num" style={{ color: lease.total_outstanding > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                        {ksh(lease.total_outstanding)}
                      </td>
                    </tr>
                  ))}
                  {ledgerRows.length === 0 && <tr><td data-label="Tenant" colSpan={8 + ledger.months.length} className="muted">No active leases in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!ledgerLoading && !ledger && (
          <p className="muted small">Choose a date range and click “Load ledger” to see payments per tenant per month.</p>
        )}
      </div>

      {editing && (
        <Modal title="Edit payment" onClose={() => setEditing(null)}>
          {err && <div className="error-banner">{err}</div>}
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Amount (KES)</label>
                <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} required />
              </div>
              <div className="field">
                <label>Period</label>
                <input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
              </div>
              <div className="field">
                <label>Method</label>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
              <button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn">Save changes</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDelete
          title="Delete payment"
          message={<p>Delete this payment of <strong>{ksh(confirmDel.amount)}</strong> for {confirmDel.unit_number} on {fmtDate(confirmDel.payment_date)}?</p>}
          onConfirm={remove}
          onClose={() => setConfirmDel(null)}
        />
      )}

      {show && (
        <ReceivePayment
          onClose={() => setShow(false)}
          onDone={() => { setShow(false); refresh(); setMsg('Payment recorded'); setTimeout(() => setMsg(''), 4000) }}
        />
      )}
    </div>
  )
}