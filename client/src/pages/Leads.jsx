import { useEffect, useState } from 'react'
import { api, useResource } from '../api.js'
import Modal from '../components/Modal.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'

const STAGES = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'viewing', label: 'Viewing' },
  { id: 'application', label: 'Application' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' }
]
const NEXT_STAGE = { new: 'contacted', contacted: 'viewing', viewing: 'application', application: 'won' }
const SOURCES = [
  { id: 'walk_in', label: 'Walk-in' },
  { id: 'referral', label: 'Referral' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'advert', label: 'Advert' },
  { id: 'signboard', label: 'Signboard' },
  { id: 'online', label: 'Online' },
  { id: 'other', label: 'Other' }
]
const EVENT_KINDS = [
  { id: 'call', label: 'Call' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'viewing', label: 'Viewing' },
  { id: 'note', label: 'Note' }
]
const sourceLabel = (id) => (SOURCES.find((s) => s.id === id) || {}).label || id
const stageLabel = (id) => (STAGES.find((s) => s.id === id) || {}).label || id

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function followUpState(lead) {
  if (!lead.next_action_at || lead.stage === 'won' || lead.stage === 'lost') return null
  const today = todayStr()
  if (lead.next_action_at < today) return 'overdue'
  if (lead.next_action_at === today) return 'today'
  return null
}

export default function Leads() {
  const { data: leads, loading, error, refresh } = useResource('/api/leads')
  const { data: units } = useResource('/api/units')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  function emptyForm() {
    return { name: '', phone: '', email: '', source: 'walk_in', unit_id: '', interest: '', notes: '', next_action_at: '' }
  }

  const vacantUnits = (units || []).filter((u) => u.status === 'vacant')

  async function openDetail(id) {
    setDetailId(id)
    setDetail(null)
    try {
      setDetail(await api.get(`/api/leads/${id}`))
    } catch (x) {
      setErr(x.message)
      setDetailId(null)
    }
  }

  async function advance(lead) {
    setErr(''); setMsg('')
    try {
      await api.post(`/api/leads/${lead.id}/stage`, { stage: NEXT_STAGE[lead.stage] })
      setMsg(`${lead.name} moved to ${stageLabel(NEXT_STAGE[lead.stage])}`)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function removeLead(reason) {
    try {
      await api.del(`/api/leads/${confirmDel.id}`, { reason })
      setMsg(`Lead ${confirmDel.name} deleted`)
      setConfirmDel(null)
      if (detailId === confirmDel.id) setDetailId(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  const byStage = {}
  for (const s of STAGES) byStage[s.id] = []
  for (const l of leads || []) if (byStage[l.stage]) byStage[l.stage].push(l)
  const openLeads = (leads || []).filter((l) => l.stage !== 'won' && l.stage !== 'lost')
  const dueCount = openLeads.filter((l) => followUpState(l)).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Leads</h2>
          <p>From first enquiry to signed lease — nothing falls through</p>
        </div>
        <button className="btn" onClick={() => { setForm(emptyForm()); setAdding(true) }}>+ Add lead</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}
      {loading && <div className="loading">Loading leads…</div>}

      {leads && (
        <>
          <div className="pipe-summary">
            <span className="chip">{openLeads.length} open</span>
            {STAGES.map((s) => (
              <span key={s.id} className={`badge ${s.id === 'won' ? 'ok' : s.id === 'lost' ? 'danger' : 'neutral'}`}>
                {s.label}: {byStage[s.id].length}
              </span>
            ))}
            {dueCount > 0 && <span className="badge accent">{dueCount} follow-up{dueCount > 1 ? 's' : ''} due</span>}
          </div>

          <div className="card pipe-board-wrap">
            <div className="pipe-board">
              {STAGES.map((s) => (
                <div className="pipe-col" key={s.id}>
                  <div className="pipe-col-head">
                    <h4>{s.label}</h4>
                    <span className="pipe-count">{byStage[s.id].length}</span>
                  </div>
                  <div className="pipe-cards">
                    {byStage[s.id].map((l) => {
                      const due = followUpState(l)
                      return (
                        <div className={`pipe-card ${l.stage}`} key={l.id} onClick={() => openDetail(l.id)}>
                          <div className="pipe-name">{l.name}</div>
                          <div className="pipe-meta">{sourceLabel(l.source)}{l.phone ? ` · ${l.phone}` : ''}</div>
                          {(l.unit_number || l.interest) && (
                            <div className="pipe-meta">
                              {l.property_name ? `${l.property_name} · ` : ''}{l.unit_number || l.interest}
                              {l.unit_rent ? ` · KSh ${Number(l.unit_rent).toLocaleString()}` : ''}
                            </div>
                          )}
                          {due && <span className="badge accent" style={{ marginTop: 6 }}>{due === 'overdue' ? 'Follow up overdue' : 'Follow up today'}</span>}
                          {l.stage === 'lost' && l.lost_reason && <div className="pipe-meta">Reason: {l.lost_reason}</div>}
                          {NEXT_STAGE[l.stage] && (
                            <div className="pipe-card-actions" onClick={(e) => e.stopPropagation()}>
                              <button className="btn small" onClick={() => advance(l)}>→ {stageLabel(NEXT_STAGE[l.stage])}</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {byStage[s.id].length === 0 && <div className="pipe-empty">—</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {adding && (
        <AddLeadModal
          form={form} setForm={setForm} units={vacantUnits}
          onClose={() => setAdding(false)}
          onSaved={(name) => { setAdding(false); setMsg(`Lead "${name}" added`); refresh() }}
        />
      )}

      {detailId && (
        <LeadDetailModal
          leadId={detailId} units={vacantUnits}
          onClose={() => setDetailId(null)}
          onChanged={(m) => { setMsg(m || ''); refresh(); }}
          onDeleted={(lead) => { setConfirmDel(lead) }}
          setErr={setErr}
        />
      )}

      {confirmDel && (
        <ConfirmDelete
          title="Delete lead"
          message={<p>Delete lead <strong>{confirmDel.name}</strong> and their activity history?</p>}
          onConfirm={removeLead}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}

function AddLeadModal({ form, setForm, units, onClose, onSaved }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      await api.post('/api/leads', { ...form, unit_id: form.unit_id || null })
      onSaved(form.name.trim())
    } catch (x) { setErr(x.message); setBusy(false) }
  }

  return (
    <Modal title="Add lead" onClose={onClose}>
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
          <div className="field">
            <label>Source</label>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Interested unit (vacant)</label>
            <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
              <option value="">Not specified</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.property_name} · {u.unit_number} · KSh {Number(u.monthly_rent).toLocaleString()}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Next follow-up</label>
            <input type="date" value={form.next_action_at} onChange={(e) => setForm({ ...form, next_action_at: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>What they want</label>
            <input value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} placeholder="e.g. 1-bedroom, parking, from March" />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Notes</label>
            <textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Add lead'}</button>
        </div>
      </form>
    </Modal>
  )
}

function LeadDetailModal({ leadId, units, onClose, onChanged, onDeleted, setErr }) {
  const [lead, setLead] = useState(null)
  const [edit, setEdit] = useState(null)
  const [note, setNote] = useState({ kind: 'call', detail: '' })
  const [converting, setConverting] = useState(false)
  const [convertForm, setConvertForm] = useState(null)
  const [lostFlow, setLostFlow] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErrLocal] = useState('')

  useEffect(() => {
    api.get(`/api/leads/${leadId}`).then((l) => {
      setLead(l)
      setConvertForm({
        start_date: todayStr(),
        duration_months: 12,
        monthly_rent: l.unit_rent ? Number(l.unit_rent) : 0,
        renewal_months: 12
      })
    }).catch((x) => { setErr(x.message); onClose() })
  }, [leadId])

  async function reload() {
    setLead(await api.get(`/api/leads/${leadId}`))
  }

  async function changeStage(stage, lost_reason) {
    setErrLocal(''); setBusy(true)
    try {
      await api.post(`/api/leads/${leadId}/stage`, { stage, lost_reason })
      await reload()
      onChanged(`Stage updated to ${stageLabel(stage)}`)
    } catch (x) { setErrLocal(x.message) }
    setBusy(false)
  }

  async function saveEdits(e) {
    e.preventDefault()
    setErrLocal(''); setBusy(true)
    try {
      await api.patch(`/api/leads/${leadId}`, { ...edit, unit_id: edit.unit_id || null })
      await reload()
      setEdit(null)
      onChanged('Lead updated')
    } catch (x) { setErrLocal(x.message) }
    setBusy(false)
  }

  async function addNote(e) {
    e.preventDefault()
    setErrLocal(''); setBusy(true)
    try {
      await api.post(`/api/leads/${leadId}/events`, note)
      setNote({ kind: 'call', detail: '' })
      await reload()
    } catch (x) { setErrLocal(x.message) }
    setBusy(false)
  }

  async function convert(e) {
    e.preventDefault()
    setErrLocal(''); setBusy(true)
    try {
      const r = await api.post('/api/onboarding', {
        unit_id: lead.unit_id,
        tenant: { name: lead.name, phone: lead.phone, email: lead.email },
        ...convertForm,
        lead_id: lead.id
      })
      await reload()
      setConverting(false)
      onChanged(`Converted — ${lead.name} onboarded into ${r.unit_number} (lease #${r.lease_id})`)
    } catch (x) { setErrLocal(x.message) }
    setBusy(false)
  }

  if (!lead) return <Modal title="Lead" onClose={onClose}><div className="loading">Loading…</div></Modal>

  const canConvert = lead.stage !== 'won' && lead.stage !== 'lost' && lead.unit_id
  const closed = lead.stage === 'won' || lead.stage === 'lost'

  return (
    <Modal title={lead.name} onClose={onClose} wide>
      {err && <div className="error-banner">{err}</div>}

      <div className="lead-head">
        <div>
          <span className="badge neutral">{stageLabel(lead.stage)}</span>{' '}
          <span className="chip">{sourceLabel(lead.source)}</span>
          {lead.unit_number && <span className="pipe-meta" style={{ display: 'block', marginTop: 6 }}>
            {lead.property_name} · {lead.unit_number} · KSh {Number(lead.unit_rent || 0).toLocaleString()}/mo
          </span>}
          {lead.phone && <div className="pipe-meta">📞 {lead.phone}{lead.email ? ` · ✉ ${lead.email}` : ''}</div>}
          {lead.interest && <div className="pipe-meta">Wants: {lead.interest}</div>}
          {lead.next_action_at && !closed && <div className="pipe-meta">Next follow-up: {lead.next_action_at}</div>}
        </div>
        <div className="inline-chips">
          <button className="btn small secondary" onClick={() => setEdit({ ...lead, next_action_at: lead.next_action_at || '' })}>Edit</button>
          <button className="btn small danger" onClick={() => onDeleted(lead)}>Delete</button>
        </div>
      </div>

      {!closed && !converting && !edit && !lostFlow && (
        <div className="pipe-stage-actions">
          {['contacted', 'viewing', 'application'].filter((s) => s !== lead.stage).map((s) => (
            <button key={s} className="btn small secondary" disabled={busy} onClick={() => changeStage(s)}>
              → {stageLabel(s)}
            </button>
          ))}
          <button className="btn small" disabled={busy} onClick={() => setConverting(true)} hidden={!canConvert}>Convert to tenant</button>
          <button className="btn small danger" disabled={busy} onClick={() => { setLostFlow(true); setLostReason('') }}>Mark lost</button>
        </div>
      )}

      {lostFlow && (
        <form onSubmit={(e) => { e.preventDefault(); changeStage('lost', lostReason) }} className="convert-box">
          <h4 style={{ marginBottom: 8 }}>Mark {lead.name} as lost</h4>
          <div className="field">
            <label>Reason *</label>
            <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="e.g. Rented elsewhere, price too high, went quiet" required autoFocus />
          </div>
          <div className="modal-foot" style={{ padding: '12px 0 0', border: 0, background: 'transparent' }}>
            <button type="button" className="btn secondary" onClick={() => setLostFlow(false)}>Back</button>
            <button type="submit" className="btn danger" disabled={busy}>Mark lost</button>
          </div>
        </form>
      )}

      {lead.stage === 'lost' && lead.lost_reason && <div className="pipe-meta" style={{ marginTop: 4 }}>Lost reason: {lead.lost_reason}</div>}
      {lead.stage === 'won' && lead.converted_lease_id && <div className="pipe-meta" style={{ marginTop: 4 }}>Converted — lease #{lead.converted_lease_id}</div>}

      {converting && convertForm && (
        <form onSubmit={convert} className="convert-box">
          <h4 style={{ marginBottom: 8 }}>Convert to tenant — {lead.property_name} · {lead.unit_number}</h4>
          <div className="form-grid">
            <div className="field">
              <label>Move-in date *</label>
              <input type="date" value={convertForm.start_date} onChange={(e) => setConvertForm({ ...convertForm, start_date: e.target.value })} required />
            </div>
            <div className="field">
              <label>Lease months</label>
              <input type="number" min="1" value={convertForm.duration_months} onChange={(e) => setConvertForm({ ...convertForm, duration_months: e.target.value })} />
            </div>
            <div className="field">
              <label>Monthly rent (KSh)</label>
              <input type="number" min="0" value={convertForm.monthly_rent} onChange={(e) => setConvertForm({ ...convertForm, monthly_rent: e.target.value })} required />
            </div>
            <div className="field">
              <label>Renewal months</label>
              <input type="number" min="1" value={convertForm.renewal_months} onChange={(e) => setConvertForm({ ...convertForm, renewal_months: e.target.value })} />
            </div>
          </div>
          <div className="modal-foot" style={{ padding: '12px 0 0', border: 0, background: 'transparent' }}>
            <button type="button" className="btn secondary" onClick={() => setConverting(false)}>Back</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? 'Onboarding…' : 'Onboard tenant'}</button>
          </div>
        </form>
      )}

      {edit && (
        <form onSubmit={saveEdits} className="convert-box">
          <h4 style={{ marginBottom: 8 }}>Edit lead</h4>
          <div className="form-grid">
            <div className="field"><label>Name *</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></div>
            <div className="field"><label>Phone</label><input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
            <div className="field"><label>Email</label><input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            <div className="field">
              <label>Source</label>
              <select value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Interested unit (vacant)</label>
              <select value={edit.unit_id || ''} onChange={(e) => setEdit({ ...edit, unit_id: e.target.value })}>
                <option value="">Not specified</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.property_name} · {u.unit_number}</option>)}
              </select>
            </div>
            <div className="field"><label>Next follow-up</label><input type="date" value={edit.next_action_at || ''} onChange={(e) => setEdit({ ...edit, next_action_at: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>What they want</label><input value={edit.interest || ''} onChange={(e) => setEdit({ ...edit, interest: e.target.value })} /></div>
          </div>
          <div className="modal-foot" style={{ padding: '12px 0 0', border: 0, background: 'transparent' }}>
            <button type="button" className="btn secondary" onClick={() => setEdit(null)}>Cancel</button>
            <button type="submit" className="btn" disabled={busy}>Save changes</button>
          </div>
        </form>
      )}

      <h4 style={{ margin: '14px 0 8px' }}>Activity</h4>
      {(lead.stage !== 'won' && lead.stage !== 'lost') && (
        <form onSubmit={addNote} className="filters" style={{ marginBottom: 10 }}>
          <select value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value })} style={{ maxWidth: 130 }}>
            {EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <input className="inp" placeholder="What happened? e.g. Called, wants viewing Saturday" value={note.detail} onChange={(e) => setNote({ ...note, detail: e.target.value })} />
          <button className="btn small" disabled={busy || !note.detail.trim()}>Log</button>
        </form>
      )}
      <div className="lead-timeline">
        {(lead.events || []).map((ev) => (
          <div className="lead-event" key={ev.id}>
            <span className={`badge ${ev.kind === 'stage' ? 'accent' : 'neutral'}`}>{ev.kind}</span>
            <span className="lead-event-detail">{ev.detail}</span>
            <span className="lead-event-when muted">{String(ev.created_at).slice(0, 16).replace('T', ' ')}</span>
          </div>
        ))}
        {(lead.events || []).length === 0 && <div className="muted">No activity yet.</div>}
      </div>
    </Modal>
  )
}
