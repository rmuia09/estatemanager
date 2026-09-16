import { useState } from 'react'
import { api, setToken } from '../api.js'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await api.post('/api/auth/login', { username, password })
      setToken(r.token)
      onLogin(r.user)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-logo">🏢</div>
          <h1>Estate Manager</h1>
          <p>Sign in to manage rentals</p>
        </div>

        {err && <div className="error-banner">{err}</div>}

        <div className="field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>

        <button className="btn btn-block" disabled={busy || !username || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="muted small login-hint">
          Default login — username <code>admin</code> · password <code>admin123</code>
        </p>
      </form>
    </div>
  )
}