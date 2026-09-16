import db, { getSettings } from './db.js'
import { sendSms, sendEmail } from './providers.js'

function getSettingsNow() {
  return getSettings()
}

function ksh(n) {
  return 'KSh ' + Math.round(Number(n || 0)).toLocaleString('en-KE')
}

function leaseSummary(leaseId) {
  return db.prepare(`
    SELECT l.*, u.unit_number, u.property_id, pr.name property_name, t.name tenant_name, t.phone, t.email
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    JOIN properties pr ON pr.id = u.property_id
    JOIN tenants t ON t.id = l.tenant_id
    WHERE l.id = ?
  `).get(leaseId)
}

function pendingUtilities(unitId) {
  const rows = db.prepare(`
    SELECT utility, COALESCE(SUM(amount), 0) total
    FROM meter_readings WHERE unit_id = ? AND status = 'pending'
    GROUP BY utility
  `).all(unitId)
  const out = {}
  for (const r of rows) out[r.utility] = r.total
  return out
}

function outstandingRent(lease) {
  const paid = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) s FROM payments WHERE lease_id = ?"
  ).get(lease.id).s
  return Math.max(0, lease.monthly_rent - paid)
}

export function buildReminderText(lease, settings = {}) {
  const months = lease.renewal_months || 12
  const utils = pendingUtilities(lease.unit_id)
  const utilTotal = (utils.water || 0) + (utils.electricity || 0)
  const lines = [
    `${lease.property_name} — Lease renewal reminder`,
    `Dear ${lease.tenant_name},`,
    `Your lease for ${lease.unit_number} expires on ${lease.end_date}.`,
    `Renewal is due for renewal every ${months} month(s).`,
    `Rent amount: ${ksh(lease.monthly_rent)}/month`,
  ]
  if (utilTotal > 0) {
    lines.push(`Outstanding utility bills: water ${ksh(utils.water || 0)} + electricity ${ksh(utils.electricity || 0)} = ${ksh(utilTotal)}`)
  }
  lines.push('Please contact the estate office to confirm renewal.')
  return lines.join('\n')
}

export function buildRentDueText(lease, settings = {}) {
  const utils = pendingUtilities(lease.unit_id)
  const utilTotal = (utils.water || 0) + (utils.electricity || 0)
  const lines = [
    `${lease.property_name} — Rent due`,
    `Dear ${lease.tenant_name},`,
    `Rent for ${lease.unit_number} (${lease.unit_number}) is ${ksh(lease.monthly_rent)}/month.`,
  ]
  if (utilTotal > 0) {
    lines.push(`Pending utilities: water ${ksh(utils.water || 0)} + electricity ${ksh(utils.electricity || 0)} = ${ksh(utilTotal)}`)
    lines.push(`Total due: ${ksh(lease.monthly_rent + utilTotal)}`)
  } else {
    lines.push(`Total due: ${ksh(lease.monthly_rent)}`)
  }
  lines.push('Please settle by the 5th of the month. Thank you.')
  return lines.join('\n')
}

function recordNotification({ channel, kind, lease, tenant_id, recipient, subject, body, status, messageId, error }) {
  return db.prepare(`
    INSERT INTO notifications (channel, kind, lease_id, tenant_id, recipient, subject, body, status, provider_message_id, error, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    channel, kind,
    lease ? lease.id : null,
    tenant_id != null ? tenant_id : (lease ? lease.tenant_id : null),
    recipient, subject, body, status, messageId || null, error || null,
    status === 'sent' || status === 'simulated' ? new Date().toISOString() : null
  ).lastInsertRowid
}

export async function notifyChannel(channel, lease, { subject, body }, settings) {
  const recipient = channel === 'sms' ? lease.phone : lease.email
  if (!recipient) return null

  let result
  if (channel === 'sms') {
    result = await sendSms(recipient, body, settings)
  } else {
    result = await sendEmail(recipient, subject, body, settings)
  }

  const status = result.ok
    ? (result.simulated ? 'simulated' : 'sent')
    : 'failed'
  const id = recordNotification({
    channel,
    kind: 'reminder',
    lease,
    recipient,
    subject,
    body,
    status,
    messageId: result.messageId || null,
    error: result.error || null
  })
  return { id, status, messageId: result.messageId, error: result.error }
}

export async function sendForLease(leaseId, kind = 'reminder') {
  const settings = getSettingsNow()
  const lease = leaseSummary(leaseId)
  if (!lease) return { error: 'lease not found' }

  const subject = kind === 'rent_due' ? 'Rent due' : 'Lease renewal reminder'
  const body = kind === 'rent_due' ? buildRentDueText(lease, settings) : buildReminderText(lease, settings)
  const results = []

  if (lease.phone) {
    const sms = await notifyChannel('sms', lease, { subject, body }, settings)
    if (sms) results.push(sms)
  }
  if (lease.email) {
    const email = await notifyChannel('email', lease, { subject, body }, settings)
    if (email) results.push(email)
  }
  if (results.length === 0) return { error: 'tenant has no phone or email on file' }

  if (kind === 'reminder' && !lease.notice_sent) {
    db.prepare('UPDATE leases SET notice_sent = 1, notice_sent_at = ? WHERE id = ?')
      .run(new Date().toISOString(), lease.id)
  }
  return { results }
}

export async function runRenewalReminders() {
  const settings = getSettingsNow()
  const lookahead = Math.max(1, Number(settings.renewal_reminder_months) || 2)
  const due = db.prepare(`
    SELECT l.id FROM leases l
    WHERE l.status = 'active' AND l.notice_sent = 0
      AND l.end_date <= date('now', '+' || ? || ' months')
    ORDER BY l.end_date ASC
  `).all(lookahead)

  const sent = []
  const failed = []
  for (const row of due) {
    try {
      const r = await sendForLease(row.id, 'reminder')
      if (r.error) failed.push({ id: row.id, error: r.error })
      else sent.push(row.id)
    } catch (e) {
      failed.push({ id: row.id, error: e.message })
    }
  }
  return { checked: due.length, sent, failed }
}

export async function sendTestMessage(channel, recipient, settings) {
  const subject = 'Estate Manager — test message'
  const body = 'This is a test message from Estate Manager. If you can read this, your ' +
    (channel === 'sms' ? 'SMS (Africa\'s Talking)' : 'email (SMTP)') + ' integration is working.'
  let result
  if (channel === 'sms') {
    result = await sendSms(recipient, body, settings)
  } else {
    result = await sendEmail(recipient, subject, body, settings)
  }
  const status = result.ok ? (result.simulated ? 'simulated' : 'sent') : 'failed'
  recordNotification({
    channel, kind: 'test', lease: null, tenant_id: null, recipient,
    subject, body, status,
    messageId: result.messageId || null,
    error: result.error || null
  })
  return result
}