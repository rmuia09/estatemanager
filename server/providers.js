import https from 'https'
import net from 'net'
import tls from 'tls'

const b64 = (s) => Buffer.from(s).toString('base64')

/* ---------------- Config builders ---------------- */
function smsConfig(s) {
  return {
    enabled: String(s.sms_enabled) === '1',
    provider: s.sms_provider || 'africas_talking',
    username: s.sms_username || '',
    apiKey: s.sms_api_key || '',
    from: s.sms_from || '',
    sandbox: String(s.sms_sandbox) === '1'
  }
}

function emailConfig(s) {
  return {
    enabled: String(s.email_enabled) === '1',
    host: s.email_host || '',
    port: Number(s.email_port) || 587,
    user: s.email_user || '',
    pass: s.email_pass || '',
    from: s.email_from || ''
  }
}

/* ---------------- SMS — Africa's Talking ---------------- */
function sendSms(recipient, message, settings) {
  const cfg = smsConfig(settings)
  if (!cfg.enabled || !cfg.username || !cfg.apiKey) {
    return Promise.resolve({ ok: true, simulated: true, error: null })
  }
  return new Promise((resolve) => {
    const host = cfg.sandbox ? 'api.sandbox.africastalking.com' : 'api.africastalking.com'
    const username = cfg.sandbox ? 'sandbox' : cfg.username
    const params = new URLSearchParams({ username, to: recipient, message })
    if (cfg.from) params.set('from', cfg.from)

    const req = https.request({
      host,
      path: '/version1/messaging',
      method: 'POST',
      headers: {
        apiKey: cfg.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params.toString())
      }
    }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          const list = j?.SMSMessageData?.Recipients
          if (list && list[0]) {
            return list[0].status === 'Success' || list[0].statusCode === 101
              ? resolve({ ok: true, messageId: list[0].messageId || null })
              : resolve({ ok: false, error: list[0].failureReason || 'SMS failed' })
          }
          resolve({ ok: true, messageId: null })
        } catch {
          resolve({ ok: true, messageId: null })
        }
      })
    })
    req.on('error', (e) => resolve({ ok: false, error: e.message }))
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: 'SMS send timed out' }) })
    req.end(params.toString())
  })
}

/* ---------------- Email — minimal SMTP client (zero deps) ---------------- */

// Runs a command sequence over a (possibly TLS) socket.
function runSmtp(socket, cfg, to, subject, bodyLines, resolve) {
  let buffer = ''
  let closed = false
  const done = (ok, error) => {
    if (closed) return
    closed = true
    try { socket.end() } catch {}
    resolve(ok ? { ok: true, messageId: null } : { ok: false, error: error || 'SMTP failed' })
  }

  const commands = [
    [`EHLO estate-manager.local`, 250],
    [`AUTH LOGIN`, 334],
    [b64(cfg.user), 334],
    [b64(cfg.pass), 235],
    [`MAIL FROM:<${cfg.from}>`, 250],
    [`RCPT TO:<${to}>`, 250],
    [`DATA`, 354],
    [[...bodyLines, '.'].join('\r\n'), 250],
    [`QUIT`, 221]
  ]
  let idx = 0

  const writeNext = () => {
    if (idx >= commands.length) return done(true)
    socket.write(commands[idx][0] + '\r\n')
  }

  const handleLine = (line) => {
    const code = Number(line.slice(0, 3))
    if (!code) return done(false, `SMTP bad response: ${line}`)
    const cmd = commands[idx]
    if (line.length > 3 && line[3] === '-') {
      if (cmd && code !== cmd[1]) return done(false, `SMTP error: ${line}`)
      return
    }
    if (cmd && code !== cmd[1]) return done(false, `SMTP error: ${line}`)
    idx++
    if (cmd[1] === 221) return done(true)
    setTimeout(writeNext, 0)
  }

  socket.on('error', (e) => done(false, e.message))
  socket.on('data', (chunk) => {
    buffer += chunk.toString()
    let nl
    while ((nl = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 2)
      handleLine(line)
      if (closed) return
    }
  })
  setTimeout(writeNext, 20)
}

function sendEmail(to, subject, body, settings) {
  const cfg = emailConfig(settings)
  if (!cfg.enabled || !cfg.host || !cfg.user) {
    return Promise.resolve({ ok: true, simulated: true, error: null })
  }
  const bodyLines = [
    `From: ${cfg.from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body
  ]

  return new Promise((resolve) => {
    let socket
    const finish = (ok, error) => {
      try { if (socket && !socket.destroyed) socket.destroy() } catch {}
      resolve(ok ? { ok: true, messageId: null } : { ok: false, error: error || 'SMTP failed' })
    }
    const run = (sock) => runSmtp(sock, cfg, to, subject, bodyLines, (r) => finish(r.ok, r.error))

    if (cfg.port === 465) {
      socket = tls.connect({ host: cfg.host, port: 465, rejectUnauthorized: false })
      socket.setTimeout(20000)
      socket.on('timeout', () => finish(false, 'SMTP timed out'))
      socket.on('connect', () => run(socket))
      socket.on('error', (e) => finish(false, e.message))
      return
    }

    // Plain TCP (e.g. 587): EHLO, then STARTTLS if advertised, then hand off.
    socket = net.connect(cfg.port, cfg.host)
    socket.setTimeout(20000)
    socket.on('timeout', () => finish(false, 'SMTP timed out'))
    let hb = ''
    let sentStartTls = false
    let upgraded = false
    socket.on('connect', () => socket.write('EHLO estate-manager.local\r\n'))
    socket.on('data', (chunk) => {
      hb += chunk.toString()
      const lines = hb.split('\r\n')
      hb = lines.pop()
      for (const line of lines) {
        if (!line.length) continue
        if (line.slice(0, 3) === '220' && sentStartTls) {
          socket.removeAllListeners('data')
          const raw = socket
          socket = tls.connect({ socket: raw, rejectUnauthorized: false })
          socket.setTimeout(20000)
          socket.on('timeout', () => finish(false, 'SMTP timed out'))
          socket.on('connect', () => run(socket))
          socket.on('error', (e) => finish(false, e.message))
          upgraded = true
          return
        }
        if (line.slice(0, 3) === '250' && !sentStartTls) {
          if (line.slice(4).toUpperCase().includes('STARTTLS')) { sentStartTls = true; socket.write('STARTTLS\r\n') }
        }
      }
      if (upgraded) return
    })
    socket.on('error', (e) => finish(false, e.message))
  })
}

export { sendSms, sendEmail, smsConfig, emailConfig }