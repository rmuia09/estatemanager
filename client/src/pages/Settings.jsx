import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Settings() {
  const [ready, setReady] = useState(false)
  const [reminder, setReminder] = useState(2)
  const [rates, setRates] = useState({ water: 0, electricity: 0 })
  const [sms, setSms] = useState({ enabled: false, username: '', api_key: '', from: '', sandbox: true, api_key_set: false })
  const [email, setEmail] = useState({ enabled: false, host: '', port: 587, user: '', pass: '', from: '', pass_set: false })
  const [test, setTest] = useState({ channel: 'sms', recipient: '', result: null })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/api/settings').then((s) => {
      setReminder(s.renewal_reminder_months || 2)
      setRates(s.rates || { water: 0, electricity: 0 })
      setSms({ enabled: !!s.sms.enabled, username: s.sms.username || '', api_key: '', from: s.sms.from || '', sandbox: !!s.sms.sandbox, api_key_set: !!s.sms.api_key_set })
      setEmail({ enabled: !!s.email.enabled, host: s.email.host || '', port: s.email.port || 587, user: s.email.user || '', pass: '', from: s.email.from || '', pass_set: !!s.email.pass_set })
      setReady(true)
    }).catch((e) => setErr(e.message))
  }, [])

  async function save() {
    setBusy(true); setErr('')
    try {
      await api.put('/api/settings', {
        renewal_reminder_months: Number(reminder),
        rates: { water: Number(rates.water), electricity: Number(rates.electricity) },
        sms: {
          enabled: sms.enabled, username: sms.username, from: sms.from, sandbox: sms.sandbox,
          api_key: sms.api_key // empty = keep existing
        },
        email: {
          enabled: email.enabled, host: email.host, port: Number(email.port), user: email.user,
          from: email.from, pass: email.pass // empty = keep existing
        }
      })
      setMsg('Settings saved')
      setTest({ ...test, result: null })
      setTimeout(() => setMsg(''), 3000)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  async function sendTest(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await api.post('/api/integrations/test', { channel: test.channel, recipient: test.recipient.trim() })
      setTest({ ...test, result: r })
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Settings &amp; integrations</h2>
          <p>Renewal timing, utility rates and notification delivery (SMS / email)</p>
        </div>
        <button className="btn" disabled={!ready || busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}

      {!ready && <div className="loading">Loading settings…</div>}

      {ready && (
        <div className="settings-grid">
          <div className="section-card">
            <h3>Lease renewals</h3>
            <label className="field">
              <span>Send expiry reminders this many months ahead</span>
              <input type="number" min="1" value={reminder} onChange={(e) => setReminder(e.target.value)} />
            </label>
            <p className="muted small">Automated reminders run on server start and every 6 hours, and manually from the Notifications page.</p>
          </div>

          <div className="section-card">
            <h3>Utility rates (KES per unit)</h3>
            <div className="form-grid">
              <div className="field">
                <label>Water</label>
                <input type="number" min="0" step="any" value={rates.water} onChange={(e) => setRates({ ...rates, water: e.target.value })} />
              </div>
              <div className="field">
                <label>Electricity</label>
                <input type="number" min="0" step="any" value={rates.electricity} onChange={(e) => setRates({ ...rates, electricity: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3>SMS — Africa's Talking</h3>
            <div className="switch-row">
              <label className="switch">
                <input type="checkbox" checked={sms.enabled} onChange={(e) => setSms({ ...sms, enabled: e.target.checked })} />
                <span className="slider" />
              </label>
              <span className="small">Send SMS notifications</span>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Username</label>
                <input value={sms.username} onChange={(e) => setSms({ ...sms, username: e.target.value })} placeholder="sandbox/AT username" />
              </div>
              <div className="field">
                <label>API key</label>
                <input type="password" value={sms.api_key} onChange={(e) => setSms({ ...sms, api_key: e.target.value })} placeholder={sms.api_key_set ? '•••••••• (leave blank to keep)' : 'Your API key'} />
              </div>
              <div className="field">
                <label>Sender ID</label>
                <input value={sms.from} onChange={(e) => setSms({ ...sms, from: e.target.value })} placeholder="optional (e.g. EstateManager)" />
              </div>
              <div className="field">
                <label>Sandbox mode</label>
                <select value={sms.sandbox ? '1' : '0'} onChange={(e) => setSms({ ...sms, sandbox: e.target.value === '1' })}>
                  <option value="1">Sandbox (test, free)</option>
                  <option value="0">Live</option>
                </select>
              </div>
            </div>
            <p className="muted small">Without credentials, messages are marked <em>simulated</em> and delivery is still recorded.</p>
          </div>

          <div className="section-card">
            <h3>Email — SMTP</h3>
            <div className="switch-row">
              <label className="switch">
                <input type="checkbox" checked={email.enabled} onChange={(e) => setEmail({ ...email, enabled: e.target.checked })} />
                <span className="slider" />
              </label>
              <span className="small">Send email notifications</span>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>SMTP host</label>
                <input value={email.host} onChange={(e) => setEmail({ ...email, host: e.target.value })} placeholder="smtp.example.com" />
              </div>
              <div className="field">
                <label>Port</label>
                <input type="number" value={email.port} onChange={(e) => setEmail({ ...email, port: e.target.value })} placeholder="587 / 465" />
              </div>
              <div className="field">
                <label>Username</label>
                <input value={email.user} onChange={(e) => setEmail({ ...email, user: e.target.value })} />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" value={email.pass} onChange={(e) => setEmail({ ...email, pass: e.target.value })} placeholder={email.pass_set ? '•••••••• (leave blank to keep)' : 'Password'} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>From address</label>
                <input value={email.from} onChange={(e) => setEmail({ ...email, from: e.target.value })} placeholder="Estate Manager <no-reply@example.com>" />
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3>Send a test message</h3>
            <form onSubmit={sendTest} className="form-grid">
              <div className="field">
                <label>Channel</label>
                <select value={test.channel} onChange={(e) => setTest({ ...test, channel: e.target.value })}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div className="field">
                <label>Recipient {test.channel === 'sms' ? '(07xxx…)' : '(email address)'}</label>
                <input value={test.recipient} onChange={(e) => setTest({ ...test, recipient: e.target.value, result: null })} required placeholder={test.channel === 'sms' ? '0712345678' : 'you@example.com'} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button className="btn secondary" disabled={busy}>Send test</button>
              </div>
            </form>
            {test.result && (
              <p className="small" style={{ marginTop: 10 }}>
                {test.result.ok
                  ? <span className="badge ok">{test.result.simulated ? 'Simulated ' : 'Sent '}✓</span>
                  : <span className="badge danger">Failed ✗</span>}
                {test.result.error && <span className="muted" style={{ marginLeft: 6 }}>{test.result.error}</span>}
              </p>
            )}
            <p className="muted small" style={{ marginTop: 8 }}>Test messages are recorded in Notifications → Activity trail.</p>
          </div>
        </div>
      )}
    </div>
  )
}