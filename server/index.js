import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db, { getSettings as getSettingsRows, logAudit } from './db.js'
import { sendForLease, runRenewalReminders, sendTestMessage } from './reminders.js'

const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'estate-manager-secret-key-CHANGE-ME'

app.use(cors())
app.use(express.json())

const DAY = 86400000
const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
const mondayOf = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const daysLeft = (dateStr) => Math.ceil((new Date(dateStr) - new Date()) / DAY)
const monthStartStr = (ym) => `${ym}-01`
const monthEndStr = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return toDateStr(new Date(y, m, 0))
}
const monthsBetween = (from, to) => {
  const out = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

const SETTING_KEYS = {
  water: 'water', electricity: 'electricity', renewal_reminder_months: 'renewal_reminder_months',
  sms_enabled: 'sms_enabled', sms_provider: 'sms_provider', sms_username: 'sms_username',
  sms_api_key: 'sms_api_key', sms_from: 'sms_from', sms_sandbox: 'sms_sandbox',
  email_enabled: 'email_enabled', email_host: 'email_host', email_port: 'email_port',
  email_user: 'email_user', email_pass: 'email_pass', email_from: 'email_from'
}

/* ---------------- Helpers ---------------- */
function requireReason(req, res) {
  const reason = req.body && req.body.reason ? String(req.body.reason).trim() : ''
  if (!reason) {
    res.status(400).json({ error: 'A reason is required for deletion — please explain why you are deleting this record.' })
    return null
  }
  return reason
}

function deleteUnitCascade(unitId) {
  db.prepare('DELETE FROM payments WHERE unit_id = ?').run(unitId)
  db.prepare('DELETE FROM meter_readings WHERE unit_id = ?').run(unitId)
  db.prepare('DELETE FROM leases WHERE unit_id = ?').run(unitId)
  db.prepare('DELETE FROM units WHERE id = ?').run(unitId)
}

/* ---------------- Auth ---------------- */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not signed in' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = db.prepare('SELECT id, username, full_name, role, active FROM users WHERE id = ?').get(payload.sub)
    if (!user || !user.active) return res.status(401).json({ error: 'User not found or deactivated' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' })
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  next()
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' })
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '12h' })
  logAudit(user, 'login', 'user', user.id, null, user.username)
  res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } })
})

app.use('/api', requireAuth)

app.get('/api/auth/me', (req, res) => res.json(req.user))

app.post('/api/auth/change-password', (req, res) => {
  const { current_password, new_password } = req.body || {}
  if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password are required' })
  if (String(new_password).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!bcrypt.compareSync(current_password, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' })
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), user.id)
  logAudit(req.user, 'change_password', 'user', user.id, null, user.username)
  res.json({ ok: true })
})

app.post('/api/auth/logout', (req, res) => {
  logAudit(req.user, 'logout', 'user', req.user.id, null, req.user.username)
  res.json({ ok: true })
})

/* ---------------- Users (admin only) ---------------- */
app.get('/api/users', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, username, full_name, role, active, created_at FROM users ORDER BY id').all())
})

app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, full_name, role } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' })
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
  if (!['admin', 'manager'].includes(role)) return res.status(400).json({ error: 'role must be admin or manager' })
  try {
    const r = db.prepare('INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)')
      .run(username.trim(), bcrypt.hashSync(password, 10), full_name || '', role)
    logAudit(req.user, 'create', 'user', r.lastInsertRowid, 'Created user', username)
    res.json({ id: r.lastInsertRowid })
  } catch {
    res.status(400).json({ error: 'Username already exists' })
  }
})

app.patch('/api/users/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  const { username, full_name, role, active, password } = req.body || {}
  if (user.id === req.user.id && active === 0) return res.status(400).json({ error: 'You cannot deactivate your own account' })

  db.prepare(`UPDATE users SET
    username = COALESCE(?, username),
    full_name = COALESCE(?, full_name),
    role = COALESCE(?, role),
    active = COALESCE(?, active),
    password_hash = CASE WHEN ? IS NULL THEN password_hash ELSE ? END
    WHERE id = ?`).run(
    username != null ? String(username).trim() : null,
    full_name != null ? full_name : null,
    role || null,
    active != null ? (active ? 1 : 0) : null,
    password ? bcrypt.hashSync(password, 10) : null,
    password ? bcrypt.hashSync(password, 10) : null,
    user.id
  )
  logAudit(req.user, 'update', 'user', user.id, 'Updated user details', username || user.username)
  res.json({ ok: true })
})

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const reason = requireReason(req, res)
  if (reason === null) return
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'user not found' })
  if (user.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' })
  const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND active = 1").get().c
  if (user.role === 'admin' && admins <= 1) return res.status(400).json({ error: 'Cannot delete the last admin' })
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id)
  logAudit(req.user, 'delete', 'user', user.id, reason, user.username)
  res.json({ ok: true })
})

/* ---------------- Dashboard ---------------- */
app.get('/api/dashboard', (req, res) => {
  db.prepare('SELECT 1').get()
  const totalUnits = db.prepare('SELECT COUNT(*) c FROM units').get().c
  const occupiedUnits = db.prepare('SELECT COUNT(*) c FROM units WHERE status = ?').get('occupied').c
  const expectedMonthly = db.prepare('SELECT COALESCE(SUM(monthly_rent),0) s FROM leases WHERE status = ?').get('active').s
  const collectedMonth = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m','now')").get().s
  const pendingUtility = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM meter_readings WHERE status = ?').get('pending').s
  const recentPayments = db.prepare(`
    SELECT p.*, u.unit_number, pr.name property_name, t.name tenant_name
    FROM payments p
    JOIN units u ON u.id = p.unit_id
    JOIN properties pr ON pr.id = u.property_id
    LEFT JOIN tenants t ON t.id = p.tenant_id
    ORDER BY p.payment_date DESC, p.id DESC LIMIT 12
  `).all()
  const expiringSoon = db.prepare(`
    SELECT l.id, l.end_date, l.monthly_rent, l.notice_sent, l.renewal_months,
           u.unit_number, pr.name property_name, t.name tenant_name, t.phone
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    JOIN properties pr ON pr.id = u.property_id
    JOIN tenants t ON t.id = l.tenant_id
    WHERE l.status = 'active'
      AND l.end_date <= date('now', '+60 days')
    ORDER BY l.end_date ASC
  `).all().map((r) => ({ ...r, days_left: daysLeft(r.end_date) }))
  const pendingNotifications = db.prepare('SELECT COUNT(*) c FROM notifications WHERE status = ?').get('failed').c

  res.json({
    totalUnits, occupiedUnits, vacantUnits: totalUnits - occupiedUnits,
    expectedMonthly, collectedMonth, monthOutstanding: Math.max(0, expectedMonthly - collectedMonth),
    pendingUtility, recentPayments, expiringSoon, pendingNotifications
  })
})

/* ---------------- Properties ---------------- */
app.get('/api/properties', (req, res) => {
  res.json(db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) unit_count,
           (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id AND u.status = 'occupied') occupied_count
    FROM properties p ORDER BY p.name
  `).all())
})

app.post('/api/properties', (req, res) => {
  const { name, location } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name is required' })
  const r = db.prepare('INSERT INTO properties (name, location) VALUES (?, ?)').run(name, location || '')
  logAudit(req.user, 'create', 'property', r.lastInsertRowid, 'Created property', name)
  res.json({ id: r.lastInsertRowid, name, location })
})

app.patch('/api/properties/:id', (req, res) => {
  const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id)
  if (!prop) return res.status(404).json({ error: 'property not found' })
  const { name, location } = req.body || {}
  db.prepare('UPDATE properties SET name = ?, location = ? WHERE id = ?')
    .run(name != null ? name : prop.name, location != null ? location : prop.location, prop.id)
  logAudit(req.user, 'update', 'property', prop.id, 'Updated property', name != null ? name : prop.name)
  res.json({ ok: true })
})

app.delete('/api/properties/:id', (req, res) => {
  const reason = requireReason(req, res)
  if (reason === null) return
  const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id)
  if (!prop) return res.status(404).json({ error: 'property not found' })
  const unitIds = db.prepare('SELECT id FROM units WHERE property_id = ?').all(prop.id)
  for (const u of unitIds) deleteUnitCascade(u.id)
  db.prepare('DELETE FROM properties WHERE id = ?').run(prop.id)
  logAudit(req.user, 'delete', 'property', prop.id, reason, `${prop.name} (${unitIds.length} units)`)
  res.json({ ok: true })
})

/* ---------------- Units ---------------- */
const UNIT_SELECT = `
  SELECT u.*, p.name property_name,
    (SELECT t.name FROM leases l JOIN tenants t ON t.id = l.tenant_id
      WHERE l.unit_id = u.id AND l.status = 'active' LIMIT 1) tenant_name,
    (SELECT t.phone FROM leases l JOIN tenants t ON t.id = l.tenant_id
      WHERE l.unit_id = u.id AND l.status = 'active' LIMIT 1) tenant_phone,
    (SELECT l.end_date FROM leases l
      WHERE l.unit_id = u.id AND l.status = 'active' LIMIT 1) lease_end,
    (SELECT l.tenant_id FROM leases l
      WHERE l.unit_id = u.id AND l.status = 'active' LIMIT 1) tenant_id
  FROM units u
  JOIN properties p ON p.id = u.property_id`

app.get('/api/units', (req, res) => {
  res.json(db.prepare(`${UNIT_SELECT} ORDER BY p.name, u.unit_number`).all())
})

app.post('/api/units', (req, res) => {
  const { property_id, unit_number, unit_type, monthly_rent, status } = req.body || {}
  if (!property_id || !unit_number) return res.status(400).json({ error: 'property_id and unit_number are required' })
  try {
    const r = db.prepare('INSERT INTO units (property_id, unit_number, unit_type, monthly_rent, status) VALUES (?, ?, ?, ?, ?)')
      .run(property_id, unit_number, unit_type || 'apartment', Number(monthly_rent) || 0, status || 'vacant')
    logAudit(req.user, 'create', 'unit', r.lastInsertRowid, 'Created unit', `${unit_number}`)
    res.json({ id: r.lastInsertRowid })
  } catch (e) {
    res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Unit number already exists in this property' : e.message })
  }
})

app.patch('/api/units/:id', (req, res) => {
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id)
  if (!unit) return res.status(404).json({ error: 'unit not found' })
  const { unit_number, unit_type, monthly_rent, status } = req.body || {}
  db.prepare('UPDATE units SET unit_number = ?, unit_type = ?, monthly_rent = ?, status = ? WHERE id = ?')
    .run(
      unit_number != null ? unit_number : unit.unit_number,
      unit_type != null ? unit_type : unit.unit_type,
      monthly_rent != null ? Number(monthly_rent) : unit.monthly_rent,
      status != null ? status : unit.status,
      unit.id
    )
  logAudit(req.user, 'update', 'unit', unit.id, 'Updated unit', unit_number != null ? unit_number : unit.unit_number)
  res.json({ ok: true })
})

app.delete('/api/units/:id', (req, res) => {
  const reason = requireReason(req, res)
  if (reason === null) return
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id)
  if (!unit) return res.status(404).json({ error: 'unit not found' })
  deleteUnitCascade(unit.id)
  logAudit(req.user, 'delete', 'unit', unit.id, reason, unit.unit_number)
  res.json({ ok: true })
})

/* Mark a unit vacant: ends its active lease (logged for audit). */
app.post('/api/units/:id/vacate', (req, res) => {
  const reason = requireReason(req, res)
  if (reason === null) return
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id)
  if (!unit) return res.status(404).json({ error: 'unit not found' })
  const activeLeases = db.prepare("SELECT id, tenant_id FROM leases WHERE unit_id = ? AND status = 'active'").all(unit.id)
  for (const l of activeLeases) {
    db.prepare('UPDATE leases SET status = ? WHERE id = ?').run('terminated', l.id)
    logAudit(req.user, 'terminate', 'lease', l.id, reason, `unit ${unit.unit_number}`)
  }
  db.prepare('UPDATE units SET status = ? WHERE id = ?').run('vacant', unit.id)
  logAudit(req.user, 'vacate', 'unit', unit.id, reason, `${unit.unit_number}${activeLeases.length ? ` · ${activeLeases.length} lease(s) ended` : ''}`)
  res.json({ ok: true, leases_ended: activeLeases.length })
})

/* ---------------- Tenants ---------------- */
app.get('/api/tenants', (req, res) => {
  res.json(db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM leases l WHERE l.tenant_id = t.id AND l.status = 'active') active_leases,
      (SELECT COUNT(*) FROM leases l WHERE l.tenant_id = t.id) total_leases
    FROM tenants t ORDER BY t.name
  `).all())
})

app.post('/api/tenants', (req, res) => {
  const { name, phone, email } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name is required' })
  const r = db.prepare('INSERT INTO tenants (name, phone, email) VALUES (?, ?, ?)').run(name, phone || '', email || '')
  logAudit(req.user, 'create', 'tenant', r.lastInsertRowid, 'Created tenant', name)
  res.json({ id: r.lastInsertRowid })
})

app.patch('/api/tenants/:id', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id)
  if (!tenant) return res.status(404).json({ error: 'tenant not found' })
  const { name, phone, email } = req.body || {}
  db.prepare('UPDATE tenants SET name = ?, phone = ?, email = ? WHERE id = ?')
    .run(name != null ? name : tenant.name, phone != null ? phone : tenant.phone, email != null ? email : tenant.email, tenant.id)
  logAudit(req.user, 'update', 'tenant', tenant.id, 'Updated tenant', name != null ? name : tenant.name)
  res.json({ ok: true })
})

app.delete('/api/tenants/:id', (req, res) => {
  const reason = requireReason(req, res)
  if (reason === null) return
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id)
  if (!tenant) return res.status(404).json({ error: 'tenant not found' })
  const linked = db.prepare('SELECT COUNT(*) c FROM leases WHERE tenant_id = ?').get(tenant.id).c
  if (linked > 0) return res.status(400).json({ error: 'Cannot delete: tenant has linked leases and payment history. End or delete their leases first.' })
  db.prepare('DELETE FROM tenants WHERE id = ?').run(tenant.id)
  logAudit(req.user, 'delete', 'tenant', tenant.id, reason, tenant.name)
  res.json({ ok: true })
})

/* ---------------- Onboarding ---------------- */
app.post('/api/onboarding', (req, res) => {
  const { unit_id, property_id, unit_number, unit_type, tenant, start_date, duration_months, monthly_rent, renewal_months } = req.body || {}
  if (!tenant || !tenant.name) return res.status(400).json({ error: 'tenant name is required' })
  if (!start_date) return res.status(400).json({ error: 'date of joining is required' })
  const months = Math.max(1, Number(duration_months) || 12)
  const renewMonths = Math.max(1, Number(renewal_months) || 12)
  const rent = Math.max(0, Number(monthly_rent) || 0)

  let unit
  if (unit_id) {
    unit = db.prepare('SELECT * FROM units WHERE id = ?').get(Number(unit_id))
  } else if (property_id && unit_number) {
    unit = db.prepare('SELECT * FROM units WHERE property_id = ? AND unit_number = ?').get(Number(property_id), String(unit_number).trim())
    if (!unit) {
      const r = db.prepare('INSERT INTO units (property_id, unit_number, unit_type, monthly_rent, status) VALUES (?, ?, ?, ?, ?)')
        .run(Number(property_id), String(unit_number).trim(), unit_type || 'apartment', rent, 'vacant')
      unit = db.prepare('SELECT * FROM units WHERE id = ?').get(r.lastInsertRowid)
    }
  }
  if (!unit) return res.status(400).json({ error: 'Select a unit or provide property + unit number' })

  const active = db.prepare("SELECT COUNT(*) c FROM leases WHERE unit_id = ? AND status = 'active'").get(unit.id).c
  if (active > 0) return res.status(400).json({ error: `Unit ${unit.unit_number} already has an active lease` })

  const tenantId = db.prepare('INSERT INTO tenants (name, phone, email) VALUES (?, ?, ?)')
    .run(tenant.name.trim(), tenant.phone || '', tenant.email || '').lastInsertRowid

  const start = new Date(start_date + 'T00:00:00')
  const end = addMonths(start, months)
  const leaseId = db.prepare('INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, renewal_months, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(unit.id, tenantId, toDateStr(start), toDateStr(end), rent, renewMonths, 'active').lastInsertRowid
  db.prepare('UPDATE units SET status = ?, monthly_rent = ? WHERE id = ?').run('occupied', rent, unit.id)

  logAudit(req.user, 'create', 'lease', leaseId, 'Onboarded tenant', `${tenant.name} → ${unit.unit_number}`)

  res.json({
    lease_id: leaseId, tenant_id: tenantId, unit_id: unit.id,
    tenant_name: tenant.name.trim(),
    unit_number: unit.unit_number, property_id: unit.property_id,
    start_date: toDateStr(start), end_date: toDateStr(end),
    monthly_rent: rent, duration_months: months, renewal_months: renewMonths
  })
})

/* ---------------- Leases / Renewals ---------------- */
app.get('/api/leases', (req, res) => {
  res.json(db.prepare(`
    SELECT l.*, u.unit_number, u.property_id, pr.name property_name, t.name tenant_name, t.phone
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    JOIN properties pr ON pr.id = u.property_id
    JOIN tenants t ON t.id = l.tenant_id
    WHERE l.status = 'active'
    ORDER BY l.end_date ASC
  `).all().map((r) => ({
    ...r,
    days_left: daysLeft(r.end_date),
    renewal_due: daysLeft(r.end_date) <= 60,
    new_rent_10pct: Math.round(r.monthly_rent * 1.1)
  })))
})

app.post('/api/leases', (req, res) => {
  const { unit_id, tenant_id, start_date, end_date, monthly_rent, renewal_months } = req.body || {}
  if (!unit_id || !tenant_id || !start_date || !end_date || !monthly_rent) {
    return res.status(400).json({ error: 'unit_id, tenant_id, start_date, end_date, monthly_rent are required' })
  }
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unit_id)
  if (!unit) return res.status(404).json({ error: 'unit not found' })
  const existing = db.prepare("SELECT COUNT(*) c FROM leases WHERE unit_id = ? AND status = 'active'").get(unit_id).c
  if (existing > 0) return res.status(400).json({ error: 'Unit already has an active lease' })
  const r = db.prepare('INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, renewal_months, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(unit_id, tenant_id, start_date, end_date, Number(monthly_rent), Math.max(1, Number(renewal_months) || 12), 'active')
  db.prepare('UPDATE units SET status = ?, monthly_rent = ? WHERE id = ?').run('occupied', Number(monthly_rent), unit_id)
  logAudit(req.user, 'create', 'lease', r.lastInsertRowid, 'Created lease', `${unit.unit_number}`)
  res.json({ id: r.lastInsertRowid })
})

app.patch('/api/leases/:id', (req, res) => {
  const lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id)
  if (!lease) return res.status(404).json({ error: 'lease not found' })
  const { start_date, end_date, monthly_rent, renewal_months } = req.body || {}
  db.prepare('UPDATE leases SET start_date = ?, end_date = ?, monthly_rent = ?, renewal_months = ? WHERE id = ?')
    .run(start_date != null ? start_date : lease.start_date,
      end_date != null ? end_date : lease.end_date,
      monthly_rent != null ? Number(monthly_rent) : lease.monthly_rent,
      renewal_months != null ? Math.max(1, Number(renewal_months) || 12) : lease.renewal_months,
      lease.id)
  if (monthly_rent != null) {
    db.prepare('UPDATE units SET monthly_rent = ? WHERE id = ?').run(Number(monthly_rent), lease.unit_id)
  }
  res.json({ ok: true })
})

app.delete('/api/leases/:id', (req, res) => {
  const reason = requireReason(req, res)
  if (reason === null) return
  const lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id)
  if (!lease) return res.status(404).json({ error: 'lease not found' })
  db.prepare('DELETE FROM leases WHERE id = ?').run(lease.id)
  const otherActive = db.prepare("SELECT COUNT(*) c FROM leases WHERE unit_id = ? AND status = 'active'").get(lease.unit_id).c
  if (otherActive === 0) db.prepare('UPDATE units SET status = ? WHERE id = ?').run('vacant', lease.unit_id)
  logAudit(req.user, 'delete', 'lease', lease.id, reason, `unit ${lease.unit_id}`)
  res.json({ ok: true })
})

app.post('/api/leases/:id/renew', (req, res) => {
  const lease = db.prepare('SELECT * FROM leases WHERE id = ? AND status = ?').get(req.params.id, 'active')
  if (!lease) return res.status(404).json({ error: 'active lease not found' })

  const renewMonths = Math.max(1, lease.renewal_months || 12)
  const start = addDays(new Date(lease.end_date), 1)
  const end = addMonths(start, renewMonths)
  const newRent = Math.round(lease.monthly_rent * 1.1)

  const r = db.prepare('INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, renewal_months, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(lease.unit_id, lease.tenant_id, toDateStr(start), toDateStr(end), newRent, renewMonths, 'active')
  db.prepare('UPDATE leases SET status = ? WHERE id = ?').run('renewed', lease.id)
  db.prepare('UPDATE leases SET notice_sent = 0, notice_sent_at = NULL WHERE id = ?').run(r.lastInsertRowid)
  db.prepare('UPDATE units SET monthly_rent = ?, status = ? WHERE id = ?').run(newRent, 'occupied', lease.unit_id)
  logAudit(req.user, 'renew', 'lease', lease.id, 'Renewed lease', `→ KSh ${newRent}/mo for ${renewMonths} months`)

  res.json({ id: r.lastInsertRowid, new_rent: newRent, start_date: toDateStr(start), end_date: toDateStr(end), renewal_months: renewMonths })
})

app.patch('/api/leases/:id/notice', async (req, res) => {
  const lease = db.prepare('SELECT * FROM leases WHERE id = ? AND status = ?').get(req.params.id, 'active')
  if (!lease) return res.status(404).json({ error: 'active lease not found' })
  try {
    const result = await sendForLease(lease.id, 'reminder')
    if (result.error) return res.status(400).json({ error: result.error })
    res.json({ ok: true, results: result.results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/leases/:id/terminate', (req, res) => {
  const lease = db.prepare('SELECT * FROM leases WHERE id = ? AND status = ?').get(req.params.id, 'active')
  if (!lease) return res.status(404).json({ error: 'active lease not found' })
  db.prepare('UPDATE leases SET status = ? WHERE id = ?').run('terminated', lease.id)
  db.prepare('UPDATE units SET status = ? WHERE id = ?').run('vacant', lease.unit_id)
  logAudit(req.user, 'terminate', 'lease', lease.id, 'Terminated lease', `unit ${lease.unit_id}`)
  res.json({ ok: true })
})

/* ---------------- Payments ---------------- */
app.get('/api/payments', (req, res) => {
  const { unit_id, tenant_id, property_id, from, to, limit } = req.query
  let sql = `
    SELECT p.*, u.unit_number, pr.name property_name, t.name tenant_name
    FROM payments p
    JOIN units u ON u.id = p.unit_id
    JOIN properties pr ON pr.id = u.property_id
    LEFT JOIN tenants t ON t.id = p.tenant_id
    WHERE 1=1
  `
  const params = []
  if (unit_id) { sql += ' AND p.unit_id = ?'; params.push(Number(unit_id)) }
  if (tenant_id) { sql += ' AND p.tenant_id = ?'; params.push(Number(tenant_id)) }
  if (property_id) { sql += ' AND u.property_id = ?'; params.push(Number(property_id)) }
  if (from) { sql += ' AND p.payment_date >= ?'; params.push(from) }
  if (to) { sql += ' AND p.payment_date <= ?'; params.push(to) }
  sql += ' ORDER BY p.payment_date DESC, p.id DESC'
  if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)) }
  res.json(db.prepare(sql).all(...params))
})

app.post('/api/payments', (req, res) => {
  const { unit_id, tenant_id, amount, payment_date, period, method, notes } = req.body || {}
  if (!unit_id || !amount || !payment_date) return res.status(400).json({ error: 'unit_id, amount, payment_date are required' })
  const active = db.prepare("SELECT id, tenant_id FROM leases WHERE unit_id = ? AND status = 'active' LIMIT 1").get(unit_id)
  const tId = tenant_id || (active && active.tenant_id) || null
  const lId = (active && active.id) || null
  const r = db.prepare('INSERT INTO payments (lease_id, unit_id, tenant_id, amount, payment_date, period, method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(lId, unit_id, tId, Number(amount), payment_date, period || payment_date.slice(0, 7), method || 'cash', notes || '')
  logAudit(req.user, 'record_payment', 'payment', r.lastInsertRowid, 'Recorded rent payment', `KSh ${Number(amount)} · unit ${unit_id} · ${payment_date}`)
  res.json({ id: r.lastInsertRowid })
})

app.patch('/api/payments/:id', (req, res) => {
  const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)
  if (!pay) return res.status(404).json({ error: 'payment not found' })
  const { amount, payment_date, period, method, notes } = req.body || {}
  db.prepare('UPDATE payments SET amount = ?, payment_date = ?, period = ?, method = ?, notes = ? WHERE id = ?')
    .run(amount != null ? Number(amount) : pay.amount,
      payment_date != null ? payment_date : pay.payment_date,
      period != null ? period : pay.period,
      method != null ? method : pay.method,
      notes != null ? notes : pay.notes,
      pay.id)
  logAudit(req.user, 'update_payment', 'payment', pay.id, 'Updated rent payment', `KSh ${amount != null ? Number(amount) : pay.amount} · ${payment_date || pay.payment_date}`)
  res.json({ ok: true })
})

app.delete('/api/payments/:id', (req, res) => {
  const reason = requireReason(req, res)
  if (reason === null) return
  const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id)
  if (!pay) return res.status(404).json({ error: 'payment not found' })
  db.prepare('DELETE FROM payments WHERE id = ?').run(pay.id)
  logAudit(req.user, 'delete', 'payment', pay.id, reason, `KSh ${pay.amount} · ${pay.payment_date}`)
  res.json({ ok: true })
})

/* ---------------- Configurable reports ---------------- */
function reportPeriodKeySql(period) {
  return period === 'monthly'
    ? "strftime('%Y-%m', p.payment_date)"
    : "date(p.payment_date, '-' || ((strftime('%w', p.payment_date) + 6) % 7) || ' days')"
}

function periodInfo(period, key) {
  if (period === 'monthly') {
    const start = monthStartStr(key)
    return { key, start, end: monthEndStr(key) }
  }
  const start = key
  return { key, start, end: toDateStr(addDays(new Date(key + 'T00:00:00'), 6)) }
}

app.get('/api/reports/summary', (req, res) => {
  const period = req.query.period === 'monthly' ? 'monthly' : 'weekly'
  const property_id = req.query.property_id ? Number(req.query.property_id) : null
  const limit = Math.min(120, Number(req.query.limit) || 12)
  const monthsBack = Number(req.query.months_back) || 12
  const from = req.query.from || toDateStr(addMonths(mondayOf(new Date()), -monthsBack))
  const to = req.query.to || toDateStr(new Date())

  const where = ['p.payment_date BETWEEN ? AND ?']
  const params = [from, to]
  if (property_id) { where.push('u.property_id = ?'); params.push(property_id) }

  const grouped = db.prepare(`
    SELECT ${reportPeriodKeySql(period)} AS pkey, pr.name AS property,
           COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS txns
    FROM payments p
    JOIN units u ON u.id = p.unit_id
    JOIN properties pr ON pr.id = u.property_id
    WHERE ${where.join(' AND ')}
    GROUP BY pkey, pr.id
    ORDER BY pkey DESC
  `).all(...params)

  const byKey = {}
  for (const g of grouped) {
    if (!byKey[g.pkey]) byKey[g.pkey] = {}
    byKey[g.pkey][g.property] = { total: g.total, txns: g.txns }
  }
  const keys = Object.keys(byKey).sort().slice(-limit).reverse()

  const periods = keys.map((k) => {
    const map = byKey[k]
    const total = Object.values(map).reduce((s, v) => s + v.total, 0)
    return { ...periodInfo(period, k), total, txns: Object.values(map).reduce((s, v) => s + v.txns, 0), byProperty: Object.entries(map).map(([property, v]) => ({ property, ...v })) }
  })

  res.json({ period, property_id: property_id || null, from, to, grand_total: periods.reduce((s, p) => s + p.total, 0), periods })
})

app.get('/api/reports/period', (req, res) => {
  const period = req.query.period === 'monthly' ? 'monthly' : 'weekly'
  const key = req.query.key
  if (!key) return res.status(400).json({ error: 'key is required' })
  const property_id = req.query.property_id ? Number(req.query.property_id) : null
  const start = period === 'monthly' ? monthStartStr(key) : key
  const end = period === 'monthly' ? monthEndStr(key) : key

  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) total, COUNT(*) txns, pr.name property
    FROM payments p
    JOIN units u ON u.id = p.unit_id
    JOIN properties pr ON pr.id = u.property_id
    WHERE p.payment_date BETWEEN ? AND ?
      ${property_id ? 'AND u.property_id = ?' : ''}
    GROUP BY pr.id
  `).all(start, end, ...(property_id ? [property_id] : []))

  const details = db.prepare(`
    SELECT p.id, p.payment_date, p.amount, p.method, p.period,
           u.unit_number, pr.name property_name, t.name tenant_name
    FROM payments p
    JOIN units u ON u.id = p.unit_id
    JOIN properties pr ON pr.id = u.property_id
    LEFT JOIN tenants t ON t.id = p.tenant_id
    WHERE p.payment_date BETWEEN ? AND ?
      ${property_id ? 'AND u.property_id = ?' : ''}
    ORDER BY p.payment_date ASC, p.id ASC
  `).all(start, end, ...(property_id ? [property_id] : []))

  res.json({
    period, key, start, end, property_id: property_id || null,
    total: totalRow.reduce((s, r) => s + r.total, 0),
    byProperty: totalRow.map((r) => ({ property: r.property, total: r.total, txns: r.txns })),
    details
  })
})

/* Keep the original weekly endpoint working (compat) */
app.get('/api/reports/weekly', (req, res) => {
  const { week } = req.query
  const grouped = db.prepare(`
    SELECT date(payment_date, '-' || ((strftime('%w', payment_date) + 6) % 7) || ' days') AS week_start,
           pr.name AS property, COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS txns
    FROM payments p
    JOIN units u ON u.id = p.unit_id
    JOIN properties pr ON pr.id = u.property_id
    ${week ? "WHERE date(payment_date, '-' || ((strftime('%w', payment_date) + 6) % 7) || ' days') = ?" : ''}
    GROUP BY week_start, pr.id
    ORDER BY week_start ASC
  `).all(week || [])

  if (!week) {
    const weeks = []
    const today = new Date()
    for (let i = 11; i >= 0; i--) {
      const ws = toDateStr(addDays(mondayOf(today), -7 * i))
      const we = toDateStr(addDays(mondayOf(today), -7 * i + 6))
      weeks.push({ week_start: ws, week_end: we, total: 0, byProperty: [] })
    }
    const byWeek = {}
    for (const g of grouped) {
      if (!byWeek[g.week_start]) byWeek[g.week_start] = {}
      byWeek[g.week_start][g.property] = { total: g.total, txns: g.txns }
    }
    for (const w of weeks) {
      const map = byWeek[w.week_start] || {}
      w.total = Object.values(map).reduce((s, v) => s + v.total, 0)
      w.byProperty = Object.entries(map).map(([property, v]) => ({ property, ...v }))
    }
    return res.json(weeks)
  }

  const details = db.prepare(`
    SELECT p.payment_date, p.amount, p.method, p.period, u.unit_number, pr.name property_name, t.name tenant_name
    FROM payments p
    JOIN units u ON u.id = p.unit_id
    JOIN properties pr ON pr.id = u.property_id
    LEFT JOIN tenants t ON t.id = p.tenant_id
    WHERE date(payment_date, '-' || ((strftime('%w', payment_date) + 6) % 7) || ' days') = ?
    ORDER BY p.payment_date ASC
  `).all(week)
  res.json({ week_start: week, total: grouped.reduce((s, g) => s + g.total, 0), byProperty: grouped.map((g) => ({ property: g.property, total: g.total, txns: g.txns })), details })
})

/* Rent ledger — payments per month per tenant with expected vs paid/arrears */
app.get('/api/reports/rent-ledger', (req, res) => {
  const { from, to, property_id, tenant_id } = req.query
  const f = from || monthStartStr(toDateStr(addMonths(new Date(), -6))).slice(0, 7)
  const t = to || toDateStr(new Date()).slice(0, 7)
  const months = monthsBetween(f.slice(0, 7), t.slice(0, 7))

  const leaseSql = [
    `SELECT l.id, l.unit_id, l.tenant_id, l.start_date, l.end_date, l.monthly_rent, l.renewal_months, l.status,
            u.unit_number, u.property_id, pr.name property_name, t.name tenant_name, t.phone
     FROM leases l
     JOIN units u ON u.id = l.unit_id
     JOIN properties pr ON pr.id = u.property_id
     JOIN tenants t ON t.id = l.tenant_id
     WHERE l.status = 'active'`
  ]
  const leaseParams = []
  if (property_id) { leaseSql.push('AND u.property_id = ?'); leaseParams.push(Number(property_id)) }
  if (tenant_id) { leaseSql.push('AND l.tenant_id = ?'); leaseParams.push(Number(tenant_id)) }
  const leases = db.prepare(leaseSql.join(' ')).all(...leaseParams)

  const paySql = [
    `SELECT p.lease_id, l.unit_id, l.tenant_id, substr(p.payment_date,1,7) AS month, COALESCE(SUM(p.amount),0) AS paid
     FROM payments p
     JOIN leases l ON l.id = p.lease_id
     JOIN units u ON u.id = p.unit_id
     WHERE p.lease_id IS NOT NULL AND p.payment_date BETWEEN ? AND ?`
  ]
  const payParams = []
  if (property_id) { paySql.push('AND u.property_id = ?'); payParams.push(Number(property_id)) }
  if (tenant_id) { paySql.push('AND l.tenant_id = ?'); payParams.push(Number(tenant_id)) }
  paySql.push('GROUP BY p.lease_id, substr(p.payment_date,1,7)')
  const pays = db.prepare(paySql.join(' ')).all(
    `${f.slice(0, 7)}-01`, monthEndStr(t.slice(0, 7)), ...payParams
  )
  const payMap = {}
  for (const p of pays) payMap[`${p.lease_id}|${p.month}`] = p.paid

  const byTenant = {}
  for (const lease of leases) {
    const entry = {
      tenant_id: lease.tenant_id, tenant_name: lease.tenant_name, phone: lease.phone,
      unit_number: lease.unit_number, property_name: lease.property_name,
      monthly_rent: lease.monthly_rent, status: lease.status,
      months: [], total_expected: 0, total_paid: 0, total_outstanding: 0
    }
    for (const m of months) {
      const ms = monthStartStr(m)
      const me = monthEndStr(m)
      if (lease.end_date < ms) continue
      if (lease.start_date > me) continue
      const expected = lease.monthly_rent
      const paid = payMap[`${lease.id}|${m}`] || 0
      const outstanding = Math.max(0, expected - paid)
      entry.months.push({ month: m, expected, paid, outstanding })
      entry.total_expected += expected
      entry.total_paid += paid
      entry.total_outstanding += outstanding
    }
    if (entry.months.length === 0) continue
    if (!byTenant[lease.tenant_id]) byTenant[lease.tenant_id] = { ...entry, leases: [] }
    byTenant[lease.tenant_id].leases.push(entry)
  }

  const rows = Object.values(byTenant).map((rt) => {
    rt.total_expected = rt.leases.reduce((s, e) => s + e.total_expected, 0)
    rt.total_paid = rt.leases.reduce((s, e) => s + e.total_paid, 0)
    rt.total_outstanding = Math.max(0, rt.total_expected - rt.total_paid)
    return rt
  })

  res.json({ from: f.slice(0, 7), to: t.slice(0, 7), months, tenants: rows })
})

/* ---------------- Utilities ---------------- */
app.get('/api/utility/rates', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)').all('water', 'electricity')
  const rates = { water: 0, electricity: 0 }
  for (const r of rows) rates[r.key] = Number(r.value)
  res.json(rates)
})

app.put('/api/utility/rates', (req, res) => {
  const { water, electricity } = req.body || {}
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  if (water != null) up.run('water', String(Number(water)))
  if (electricity != null) up.run('electricity', String(Number(electricity)))
  logAudit(req.user, 'update_rates', 'settings', null, 'Updated utility rates', `water ${water} · electricity ${electricity}`)
  res.json({ ok: true })
})

app.get('/api/readings', (req, res) => {
  const { unit_id, from, to } = req.query
  let sql = `
    SELECT mr.*, u.unit_number, pr.name property_name
    FROM meter_readings mr
    JOIN units u ON u.id = mr.unit_id
    JOIN properties pr ON pr.id = u.property_id
    WHERE 1=1
  `
  const params = []
  if (unit_id) { sql += ' AND mr.unit_id = ?'; params.push(Number(unit_id)) }
  if (from) { sql += ' AND mr.reading_date >= ?'; params.push(from) }
  if (to) { sql += ' AND mr.reading_date <= ?'; params.push(to) }
  sql += ' ORDER BY mr.reading_date DESC, mr.id DESC'
  res.json(db.prepare(sql).all(...params))
})

app.post('/api/readings', (req, res) => {
  const { unit_id, utility, reading_date, current_reading, rate_per_unit, notes } = req.body || {}
  if (!unit_id || !utility || !reading_date || current_reading == null) {
    return res.status(400).json({ error: 'unit_id, utility, reading_date, current_reading are required' })
  }
  if (!['water', 'electricity'].includes(utility)) return res.status(400).json({ error: 'utility must be water or electricity' })

  const prev = db.prepare(`
    SELECT current_reading FROM meter_readings
    WHERE unit_id = ? AND utility = ?
    ORDER BY reading_date DESC, id DESC LIMIT 1
  `).get(Number(unit_id), utility)

  const rates = rate_per_unit != null
    ? Number(rate_per_unit)
    : (() => { const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(utility); return row ? Number(row.value) : 0 })()

  const previous = prev ? prev.current_reading : 0
  const consumption = Math.round((Number(current_reading) - previous) * 100) / 100
  if (consumption < 0) return res.status(400).json({ error: 'current reading is lower than previous reading' })

  const amount = Math.round(consumption * rates * 100) / 100
  const r = db.prepare('INSERT INTO meter_readings (unit_id, utility, reading_date, current_reading, previous_reading, consumption, rate_per_unit, amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(Number(unit_id), utility, reading_date, Number(current_reading), previous, consumption, rates, amount, 'pending', notes || '')
  logAudit(req.user, 'record_reading', 'reading', r.lastInsertRowid, 'Recorded meter reading', `${utility} · unit ${unit_id} · used ${consumption}`)
  res.json({ id: r.lastInsertRowid, previous_reading: previous, consumption, rate_per_unit: rates, amount })
})

app.patch('/api/readings/:id', (req, res) => {
  const reading = db.prepare('SELECT * FROM meter_readings WHERE id = ?').get(req.params.id)
  if (!reading) return res.status(404).json({ error: 'reading not found' })
  const { rate_per_unit, status, notes } = req.body || {}
  const rate = rate_per_unit != null ? Number(rate_per_unit) : reading.rate_per_unit
  const amount = Math.round(reading.consumption * rate * 100) / 100
  db.prepare('UPDATE meter_readings SET rate_per_unit = ?, status = ?, notes = ?, amount = ? WHERE id = ?')
    .run(rate, status != null ? status : reading.status, notes != null ? notes : reading.notes, amount, reading.id)
  logAudit(req.user, status != null ? 'mark_' + status : 'update_reading', 'reading', reading.id, status != null ? `Marked reading ${status}` : 'Updated meter reading', `${reading.utility} · unit ${reading.unit_id}`)
  res.json({ ok: true })
})

app.delete('/api/readings/:id', (req, res) => {
  const reason = requireReason(req, res)
  if (reason === null) return
  const r = db.prepare('DELETE FROM meter_readings WHERE id = ?').run(req.params.id)
  if (r.changes === 0) return res.status(404).json({ error: 'reading not found' })
  logAudit(req.user, 'delete', 'reading', req.params.id, reason)
  res.json({ ok: true })
})

/* ---------------- Settings / Integrations ---------------- */
app.get('/api/settings', (req, res) => {
  const s = getSettingsRows()
  res.json({
    renewal_reminder_months: Number(s.renewal_reminder_months) || 2,
    rates: { water: Number(s.water) || 0, electricity: Number(s.electricity) || 0 },
    sms: {
      enabled: String(s.sms_enabled) === '1',
      provider: s.sms_provider || 'africas_talking',
      username: s.sms_username || '',
      from: s.sms_from || '',
      sandbox: String(s.sms_sandbox) === '1',
      api_key_set: !!(s.sms_api_key)
    },
    email: {
      enabled: String(s.email_enabled) === '1',
      host: s.email_host || '',
      port: Number(s.email_port) || 587,
      user: s.email_user || '',
      from: s.email_from || '',
      pass_set: !!(s.email_pass)
    }
  })
})

app.put('/api/settings', (req, res) => {
  const body = req.body || {}
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  const setFlat = (key, val) => { if (val != null) up.run(key, String(val)) }

  if (body.renewal_reminder_months != null) setFlat('renewal_reminder_months', Math.max(1, Number(body.renewal_reminder_months) || 2))
  if (body.rates) {
    if (body.rates.water != null) setFlat('water', Number(body.rates.water))
    if (body.rates.electricity != null) setFlat('electricity', Number(body.rates.electricity))
  }
  if (body.sms) {
    const sms = body.sms
    setFlat('sms_enabled', sms.enabled != null ? (sms.enabled ? 1 : 0) : undefined)
    if (sms.provider) setFlat('sms_provider', sms.provider)
    if (sms.username != null) setFlat('sms_username', sms.username)
    if (sms.sandbox != null) setFlat('sms_sandbox', sms.sandbox ? 1 : 0)
    if (sms.from != null) setFlat('sms_from', sms.from)
    if (sms.api_key != null && String(sms.api_key).length > 0) setFlat('sms_api_key', String(sms.api_key).trim())
  }
  if (body.email) {
    const em = body.email
    setFlat('email_enabled', em.enabled != null ? (em.enabled ? 1 : 0) : undefined)
    if (em.host != null) setFlat('email_host', em.host)
    if (em.port != null) setFlat('email_port', em.port)
    if (em.user != null) setFlat('email_user', em.user)
    if (em.pass != null && String(em.pass).length > 0) setFlat('email_pass', String(em.pass))
    if (em.from != null) setFlat('email_from', em.from)
  }
  logAudit(req.user, 'update_settings', 'settings', null, 'Updated settings / integrations', body.sms || body.email ? 'notification providers' : 'reminder & rates')
  res.json({ ok: true })
})

app.post('/api/integrations/test', async (req, res) => {
  const { channel, recipient } = req.body || {}
  if (!channel || !recipient) return res.status(400).json({ error: 'channel and recipient are required' })
  const s = getSettingsRows()
  const r = await sendTestMessage(channel, recipient, s)
  logAudit(req.user, 'test_integration', 'settings', null, `Tested ${channel} integration`, `${recipient} · ${r.ok ? (r.simulated ? 'simulated' : 'sent') : 'failed'}`)
  res.json({ ok: r.ok, simulated: !!r.simulated, messageId: r.messageId || null, error: r.error || null })
})

/* ---------------- Notifications & reminders ---------------- */
app.get('/api/notifications', (req, res) => {
  const { kind, status, channel, limit } = req.query
  let sql = `
    SELECT n.*, u.unit_number, pr.name property_name, t.name tenant_name
    FROM notifications n
    LEFT JOIN leases l ON l.id = n.lease_id
    LEFT JOIN units u ON u.id = l.unit_id
    LEFT JOIN properties pr ON pr.id = u.property_id
    LEFT JOIN tenants t ON t.id = n.tenant_id
    WHERE 1=1
  `
  const params = []
  if (kind) { sql += ' AND n.kind = ?'; params.push(kind) }
  if (status) { sql += ' AND n.status = ?'; params.push(status) }
  if (channel) { sql += ' AND n.channel = ?'; params.push(channel) }
  sql += ' ORDER BY n.id DESC'
  if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)) }
  res.json(db.prepare(sql).all(...params))
})

app.get('/api/notifications/stats', (req, res) => {
  const rows = db.prepare('SELECT channel, status, COUNT(*) c FROM notifications GROUP BY channel, status').all()
  res.json(rows)
})

app.post('/api/notifications', async (req, res) => {
  const { lease_id, kind } = req.body || {}
  if (!lease_id) return res.status(400).json({ error: 'lease_id is required' })
  const type = kind === 'rent_due' ? 'rent_due' : 'reminder'
  try {
    const r = await sendForLease(lease_id, type)
    if (r.error) return res.status(400).json({ error: r.error })
    logAudit(req.user, 'notify', 'lease', lease_id, `Sent ${type} notification`, JSON.stringify(r.results.map((x) => x.status)))
    res.json({ ok: true, results: r.results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/reminders/run', async (req, res) => {
  try {
    const r = await runRenewalReminders()
    logAudit(req.user, 'reminders', null, null, 'Ran automated renewal reminders', `checked ${r.checked}, sent ${r.sent.length}`)
    res.json(r)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/activity', (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 200)
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit))
})

/* ---------------- Production static hosting (single service) ---------------- */
// When a client build exists (client/dist), serve it next to the API so a single
// web service can host the whole app (Render/Railway/Heroku, or `node server/index.js`).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../client/dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
  console.log(`Static app enabled: serving ${distDir}`)
}

/* ---------------- Startup ---------------- */
app.listen(PORT, () => {
  console.log(`Estate Manager API running on http://localhost:${PORT}`)
  runRenewalReminders().then((r) => {
    console.log(`Reminder engine: checked ${r.checked} lease(s), sent ${r.sent.length}`)
  }).catch((e) => console.error('Reminder engine failed:', e.message))
  setInterval(() => {
    runRenewalReminders().catch((e) => console.error('Reminder engine failed:', e.message))
  }, 6 * 60 * 60 * 1000)
})