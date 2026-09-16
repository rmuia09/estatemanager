import { useState } from 'react'
import { api } from '../api.js'

export default function Account({ user, onLogout }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (next !== confirm) return setErr('New passwords do not match')
    setBusy(true)
    try {
      await api.post('/api/auth/change-password', { current_password: current, new_password: next })
      setMsg('Password changed successfully')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>My account</h2>
          <p>Signed in as {user.username} · {user.role}</p>
        </div>
        <button className="btn danger" onClick={onLogout}>Logout</button>
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <h3>Change password</h3>
        {msg && <div className="success-banner">{msg}</div>}
        {err && <div className="error-banner">{err}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Current password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>New password</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
        </form>
      </div>
    </div>
  )
}