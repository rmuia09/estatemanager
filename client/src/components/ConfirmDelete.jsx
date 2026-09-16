import { useState } from 'react'
import Modal from './Modal.jsx'

export default function ConfirmDelete({ title, message, confirmLabel = 'Delete permanently', onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!reason.trim()) { setErr('Please enter a reason for this deletion.'); return }
    setBusy(true)
    try {
      await onConfirm(reason.trim())
    } catch (x) {
      setErr(x.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {message}
        <div className="field" style={{ marginTop: 14 }}>
          <label>Reason for deletion *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            autoFocus
            placeholder="e.g. Tenant vacated, data entry error, damaged record…"
          />
        </div>
        {err && <div className="error-banner" style={{ marginTop: 10 }}>{err}</div>}
        <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn danger" disabled={busy || !reason.trim()}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}