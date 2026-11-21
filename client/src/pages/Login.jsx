import { useState } from 'react'
import { api, setToken } from '../api.js'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('login')
  const [forgotIdent, setForgotIdent] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await api.post('/api/auth/login', { username, password })
      setToken(r.token)
      onLogin(r.user)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  async function sendReset(e) {
    e.preventDefault()
    setBusy(true); setErr(''); setForgotMsg('')
    try {
      const r = await api.post('/api/auth/forgot-password', { email: forgotIdent })
      setForgotMsg(r.message || 'Reset link sent.')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setBusy(true); setErr(''); setResetMsg('')
    try {
      const r = await api.post('/api/auth/reset-password', { token: resetToken, new_password: newPassword })
      setResetMsg(r.message || 'Password reset.')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={mode === 'reset' ? resetPassword : mode === 'forgot' ? sendReset : submit}>
        <div className="login-brand">
          <div className="brand-logo">🏢</div>
          <h1>Estate Manager</h1>
          <p>Sign in to manage rentals</p>
        </div>

        {err && <div className="error-banner">{err}</div>}

        {mode === 'login' && (
          <>
            <div className="field">
              <label htmlFor="login-username">Username</label>
              <input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button className="btn btn-block" disabled={busy || !username || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="login-hint">
              <button className="btn small secondary btn-block" type="button" disabled={busy} onClick={() => { setMode('forgot'); setForgotMsg(''); setResetMsg('') }}>
                Forgot password?
              </button>
            </div>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <div className="field">
              <label htmlFor="forgot-ident">Username or email</label>
              <input id="forgot-ident" value={forgotIdent} onChange={(e) => setForgotIdent(e.target.value)} autoComplete="username" />
            </div>
            <button className="btn btn-block" disabled={busy || !forgotIdent}>
              Send reset link
            </button>
            {forgotMsg && <p className="login-hint">{forgotMsg}</p>}
            <div className="login-hint">
              <button className="btn small secondary btn-block" type="button" disabled={busy} onClick={() => { setMode('reset'); setResetMsg(''); setErr('') }}>
                Reset with token
              </button>
              <button className="btn small secondary btn-block" type="button" disabled={busy} onClick={() => { setMode('login'); setForgotMsg('') }}>
                Back to sign in
              </button>
            </div>
          </>
        )}

        {mode === 'reset' && (
          <>
            <div className="field">
              <label htmlFor="reset-token">Reset token</label>
              <input id="reset-token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="reset-password">New password</label>
              <input id="reset-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <button className="btn btn-block" disabled={busy || !resetToken || !newPassword}>
              Set new password
            </button>
            {resetMsg && <p className="login-hint">{resetMsg}</p>}
            <div className="login-hint">
              <button className="btn small secondary btn-block" type="button" disabled={busy} onClick={() => { setMode('login'); setResetMsg('') }}>
                Back to sign in
              </button>
            </div>
          </>
        )}

        {mode === 'login' && (
          <p className="login-hint">
            Default login — username <code>admin</code> · password <code>admin123</code>
          </p>
        )}
      </form>
    </div>
  )
}
