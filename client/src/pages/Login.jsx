import { useState } from 'react'
import { motion } from 'framer-motion'
import { api, setToken } from '../api.js'
import { design } from '../design-system.js'
import YaneMark from '../components/YaneMark.jsx'

const ease = design.motion.easings.smooth

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}
const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: design.motion.durations.reveal, ease } },
}

const HIGHLIGHTS = [
  { icon: '🏘️', title: 'Every unit, live', text: 'Occupied, vacant or on notice — your whole portfolio on one screen.' },
  { icon: '🎯', title: 'Leads that never go cold', text: 'A pipeline with follow-up dates, so no enquiry is forgotten.' },
  { icon: '💰', title: 'Rent without the chase', text: 'Payments, arrears and receipts tracked automatically.' },
]

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
    <div className="login-split">
      {/* Left: brand showcase */}
      <div className="login-hero" aria-hidden="true">
        <div className="login-orb orb-a" />
        <div className="login-orb orb-b" />
        <div className="login-hero-inner">
          <motion.div className="login-hero-brand" variants={stagger} initial="hidden" animate="show">
            <motion.div variants={rise}><YaneMark size={50} variant="onDark" /></motion.div>
            <motion.h2 variants={rise}>yane</motion.h2>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" animate="show" className="login-hero-copy">
            <motion.h1 variants={rise}>Run your rentals like <em>a pro</em>.</motion.h1>
            <motion.p variants={rise}>
              Units, tenants, leases, rent and leads — one system replaces the
              notebooks, WhatsApp threads and end-of-month panic.
            </motion.p>
            <ul>
              {HIGHLIGHTS.map((h) => (
                <motion.li variants={rise} key={h.title}>
                  <span className="hl-ico">{h.icon}</span>
                  <span><strong>{h.title}</strong><small>{h.text}</small></span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" animate="show" className="login-hero-chips">
            <motion.span variants={rise} className="chip-glass">🔒 Role-based access</motion.span>
            <motion.span variants={rise} className="chip-glass">📊 Live reports</motion.span>
            <motion.span variants={rise} className="chip-glass">🇰🇪 Built for Kenya</motion.span>
          </motion.div>
        </div>
      </div>

      {/* Right: the form */}
      <div className="login-panel">
        <motion.form
          className="login-card"
          onSubmit={mode === 'reset' ? resetPassword : mode === 'forgot' ? sendReset : submit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: design.motion.durations.reveal, ease, delay: 0.1 }}
        >
          <div className="login-brand">
            <YaneMark size={58} />
            <h1>yane</h1>
            <p>
              {mode === 'login' && 'Sign in to manage rentals'}
              {mode === 'forgot' && 'We’ll send you a reset token'}
              {mode === 'reset' && 'Paste the token and choose a new password'}
            </p>
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
                {busy ? 'Signing in…' : 'Sign in →'}
              </button>
              <div className="login-hint">
                <button className="btn small secondary btn-block" type="button" disabled={busy} onClick={() => { setMode('forgot'); setForgotMsg(''); setResetMsg('') }}>
                  Forgot password?
                </button>
              </div>
              <p className="login-hint">
                Demo login — username <code>admin</code> · password <code>admin123</code>
              </p>
              <p className="login-hint login-site-link">
                <a href="/landing.html">← Back to yane</a>
              </p>
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
        </motion.form>
      </div>
    </div>
  )
}
