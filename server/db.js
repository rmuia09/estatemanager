import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'estate.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT DEFAULT 'manager',
  active        INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  location   TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number  TEXT NOT NULL,
  unit_type    TEXT DEFAULT 'apartment',
  monthly_rent INTEGER NOT NULL DEFAULT 0,
  status       TEXT DEFAULT 'occupied',
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(property_id, unit_number)
);

CREATE TABLE IF NOT EXISTS tenants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id        INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id),
  start_date     TEXT NOT NULL,
  end_date       TEXT NOT NULL,
  monthly_rent   INTEGER NOT NULL,
  renewal_months INTEGER DEFAULT 12,
  status         TEXT DEFAULT 'active',
  notice_sent    INTEGER DEFAULT 0,
  notice_sent_at TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lease_id     INTEGER REFERENCES leases(id) ON DELETE SET NULL,
  unit_id      INTEGER NOT NULL REFERENCES units(id),
  tenant_id    INTEGER REFERENCES tenants(id),
  amount       INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  period       TEXT NOT NULL,
  method       TEXT DEFAULT 'cash',
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meter_readings (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id          INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  utility          TEXT NOT NULL CHECK (utility IN ('water','electricity')),
  reading_date     TEXT NOT NULL,
  current_reading  REAL NOT NULL,
  previous_reading REAL NOT NULL DEFAULT 0,
  consumption      REAL NOT NULL DEFAULT 0,
  rate_per_unit    REAL NOT NULL DEFAULT 0,
  amount           REAL NOT NULL DEFAULT 0,
  status           TEXT DEFAULT 'pending',
  notes            TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  channel            TEXT NOT NULL CHECK (channel IN ('sms','email','test')),
  kind               TEXT NOT NULL DEFAULT 'reminder',
  lease_id           INTEGER,
  tenant_id          INTEGER,
  recipient          TEXT,
  subject            TEXT,
  body               TEXT,
  status             TEXT DEFAULT 'pending',
  provider_message_id TEXT,
  error              TEXT,
  sent_at            TEXT,
  created_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  username    TEXT,
  action      TEXT,
  entity_type TEXT,
  entity_id   INTEGER,
  reason      TEXT,
  details     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  path       TEXT DEFAULT '/',
  ip         TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_units_property   ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit      ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_status    ON leases(status);
CREATE INDEX IF NOT EXISTS idx_payments_date    ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_unit    ON payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_readings_unit    ON meter_readings(unit_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created    ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_created   ON visits(created_at);
`)

/* ---------------- Migration for existing databases ---------------- */
function columnExists(table, col) {
  return !!db.prepare(`PRAGMA table_info(${table})`).all().find((c) => c.name === col)
}

function deleteUnitCascade(unitId) {
  db.prepare('DELETE FROM payments WHERE unit_id = ?').run(unitId)
  db.prepare('DELETE FROM meter_readings WHERE unit_id = ?').run(unitId)
  db.prepare('DELETE FROM leases WHERE unit_id = ?').run(unitId)
  db.prepare('DELETE FROM units WHERE id = ?').run(unitId)
}

function migrate() {
  if (!columnExists('leases', 'renewal_months')) {
    db.exec('ALTER TABLE leases ADD COLUMN renewal_months INTEGER DEFAULT 12')
  }
  if (!columnExists('leases', 'notice_sent_at')) {
    db.exec('ALTER TABLE leases ADD COLUMN notice_sent_at TEXT')
  }
  db.exec('UPDATE leases SET renewal_months = 12 WHERE renewal_months IS NULL OR renewal_months < 1')

  const legacyProps = db.prepare(
    "SELECT id, name FROM properties WHERE lower(name) LIKE '%boma%' OR lower(name) = 'house 50'"
  ).all()
  for (const p of legacyProps) {
    const unitIds = db.prepare('SELECT id FROM units WHERE property_id = ?').all(p.id)
    for (const u of unitIds) deleteUnitCascade(u.id)
    db.prepare('DELETE FROM properties WHERE id = ?').run(p.id)
    console.log(`Migrated: removed legacy property "${p.name}"`)
  }
  const bomaAny = db.prepare(
    "SELECT COUNT(*) c FROM properties WHERE lower(name) LIKE '%boma%' OR lower(name) = 'house 50'"
  ).get().c
  if (bomaAny > 0) console.log('Warning: legacy Boma/House references still present')
}

migrate()

/* ---------------- Settings ---------------- */
const SETTINGS_DEFAULTS = {
  water: '80',
  electricity: '30',
  renewal_reminder_months: '2',
  sms_enabled: '0',
  sms_provider: 'africas_talking',
  sms_username: '',
  sms_api_key: '',
  sms_from: '',
  sms_sandbox: '1',
  email_enabled: '0',
  email_host: '',
  email_port: '587',
  email_user: '',
  email_pass: '',
  email_from: ''
}

function ensureSettings() {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of Object.entries(SETTINGS_DEFAULTS)) insert.run(k, v)
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM properties').get().c
  if (count > 0) return

  const DAY = 86400000
  const toStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
  const mondayOf = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }

  const today = new Date()
  const rand = (n) => Math.floor(Math.random() * n)

  const names = [
    'John Kamau', 'Mary Wanjiku', 'Peter Otieno', 'Faith Achieng', 'Brian Mwangi',
    'Grace Njeri', 'David Mutua', 'Esther Wambui', 'Samuel Kiprop', 'Lucy Chebet',
    'James Omondi', 'Rose Muthoni', 'Daniel Maina', 'Agnes Akinyi', 'Kevin Njoroge',
    'Diana Wairimu', 'Eric Kariuki', 'Catherine Awuor', 'Brian Kipchoge', 'Nancy Moraa',
    'George Kibet', 'Janet Kerubo', 'Michael Osoro', 'Sylvia Atieno', 'Stephen Bundotich',
    'Ruth Chepkemoi', 'Vincent Musyoka', 'Caroline Nekesa', 'Anthony Waweru', 'Monica Jerop',
    'Joseph Ruto', 'Purity Cherono', 'Isaac Mburu', 'Hellen Kandie', 'Francis Ochieng',
    'Mercy Cherotich', 'Simon Nganga', 'Jane Nasimiyu', 'Andrew Kimutai', 'Beatrice Mwende',
    'Patrick Kilonzo', 'Judith Aoko', 'Charles Sang', 'Rebecca Wawira', 'Lawrence Ouma',
    'Sara Meilut', 'Dennis Kiplagat', 'Naomi Chebet', 'Elijah Barngetuny', 'Tabitha Cherono'
  ]

  const propertiesData = [
    { name: 'Melon Park', location: 'Eldoret', type: 'apartment', unitNumbers: ['A1','A2','A3','A4','A5','A6','A7','A8','B1','B2','B3','B4','B5','B6','B7','B8','C1','C2','C3','C4','C5','C6','C7','C8','D1','D2','D3','D4','D5','D6','D7','D8'], baseRent: 2200 },
    { name: 'Block 13', location: 'Eldoret', type: 'bedsitter', unitNumbers: ['13-01','13-02','13-03','13-04','13-05','13-06','13-07','13-08','13-09','13-10','13-11','13-12','13-13'], baseRent: 1500 },
    { name: 'Block 3', location: 'Eldoret', type: 'bedsitter', unitNumbers: ['3-01','3-02','3-03'], baseRent: 1500 }
  ]

  const insProp = db.prepare('INSERT INTO properties (name, location) VALUES (?, ?)')
  const insUnit = db.prepare('INSERT INTO units (property_id, unit_number, unit_type, monthly_rent, status) VALUES (?, ?, ?, ?, ?)')
  const insTenant = db.prepare('INSERT INTO tenants (name, phone, email) VALUES (?, ?, ?)')
  const insLease = db.prepare('INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, renewal_months, status, notice_sent, notice_sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insPay = db.prepare('INSERT INTO payments (lease_id, unit_id, tenant_id, amount, payment_date, period, method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const insRead = db.prepare('INSERT INTO meter_readings (unit_id, utility, reading_date, current_reading, previous_reading, consumption, rate_per_unit, amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')

  const unitRents = []
  let nameIdx = 0
  let unitId = 1

  const properties = []
  for (const p of propertiesData) {
    const propRes = insProp.run(p.name, p.location)
    const propId = propRes.lastInsertRowid
    properties.push({ id: propId, name: p.name, type: p.type })

    p.unitNumbers.forEach((num, i) => {
      const rent = p.type === 'apartment'
        ? p.baseRent + (i % 5) * 200 + (i % 3) * 100
        : p.baseRent + (i % 3) * 150
      insUnit.run(propId, num, p.type, rent, 'occupied')
      unitRents.push({ unitId, rent })
      unitId++
      nameIdx++
    })
  }

  for (let i = 0; i < unitRents.length; i++) {
    const tenantId = i + 1
    insTenant.run(names[i], `07${String(10000000 + i * 137 + rand(899)).slice(0, 8)}`, `${names[i].toLowerCase().replace(/ /g, '.')}@example.com`)
    const dueSoon = i % 7 === 0
    const endMonths = dueSoon ? (i % 5) % 3 : 3 + (i % 12)
    const end = addMonths(today, endMonths)
    const start = addMonths(end, -12)
    const rent = unitRents[i].rent
    const notice = dueSoon && i % 2 === 0 ? 1 : 0
    const renewalMonths = dueSoon ? 3 : 12
    const leaseRes = insLease.run(unitRents[i].unitId, tenantId, toStr(start), toStr(end), rent, renewalMonths, 'active', notice, notice ? new Date().toISOString() : null)
    const leaseId = leaseRes.lastInsertRowid

    const months = []
    for (let w = 0; w < 12; w++) {
      const ws = toStr(addDays(mondayOf(today), -7 * w)).slice(0, 7)
      if (!months.includes(ws)) months.push(ws)
    }
    for (const month of months) {
      if (Math.random() > 0.82) continue
      const [y, m] = month.split('-').map(Number)
      let payDate = new Date(y, m - 1, 1 + rand(28))
      if (payDate > today) payDate = today
      const pay = Math.random() > 0.25 ? rent : Math.round(rent * (0.4 + Math.random() * 0.4))
      const methods = ['cash', 'M-Pesa', 'bank']
      insPay.run(leaseId, unitRents[i].unitId, tenantId, pay, toStr(payDate), month, methods[rand(3)], '')
    }

    if (Math.random() > 0.25) {
      const prev = 300 + rand(2000)
      const curr = prev + 8 + rand(40)
      const wRate = 80
      insRead.run(unitRents[i].unitId, 'water', toStr(addDays(today, -rand(45))), curr, prev, Math.round((curr - prev) * 100) / 100, wRate, Math.round((curr - prev) * wRate * 100) / 100, Math.random() > 0.45 ? 'paid' : 'pending', '')
      const ePrev = 100 + rand(3000)
      const eCurr = ePrev + 20 + rand(90)
      const eRate = 30
      insRead.run(unitRents[i].unitId, 'electricity', toStr(addDays(today, -rand(45))), eCurr, ePrev, Math.round((eCurr - ePrev) * 100) / 100, eRate, Math.round((eCurr - ePrev) * eRate * 100) / 100, Math.random() > 0.45 ? 'paid' : 'pending', '')
    }
  }

  console.log('Seeded estate database with', properties.length, 'properties,', unitRents.length, 'units.')
}

function seedAdmin() {
  const exists = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  if (exists > 0) return
  db.prepare('INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)')
    .run('admin', bcrypt.hashSync('admin123', 10), 'Administrator', 'admin')
  console.log('Created default admin user — username: admin, password: admin123')
}

seedIfEmpty()
ensureSettings()
seedAdmin()

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const out = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export function logAudit({ user_id, username }, action, entity_type, entity_id, reason, details) {
  db.prepare('INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, reason, details) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(user_id != null ? user_id : null, username || '', action, entity_type, entity_id != null ? entity_id : null, reason || '', details || '')
}

let visitInsertCount = 0
export function logVisit({ path = '/', ip = '', user_agent = '' }) {
  try {
    db.prepare('INSERT INTO visits (path, ip, user_agent) VALUES (?, ?, ?)').run(path, ip || '', user_agent || '')
    visitInsertCount++
    if (visitInsertCount % 200 === 0) pruneVisits()
  } catch (e) {
    console.error('Failed to log visit:', e.message)
  }
}

export function pruneVisits(keep = 10000) {
  db.prepare('DELETE FROM visits WHERE id NOT IN (SELECT id FROM visits ORDER BY id DESC LIMIT ?)').run(keep)
}

export default db