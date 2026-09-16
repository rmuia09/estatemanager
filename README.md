# Estate Manager

Rental management system for the estate (**Melon Park** — 32 units, **Block 13** — 13 units, **Block 3** — 3 units; 48 units, scales beyond).

## Features
- **Sign-in & user management** — JWT login, roles (**admin** / **manager**), password change, and an admin-only Users page. All API routes require authentication.
- **Tenant onboarding** — one form creates a tenant + lease and marks the unit occupied; pick a vacant unit or create a new one. Vacant/Occupy & Vacate actions keep units and leases consistent.
- **Rent income** — record payments (cash / M-Pesa / bank) per unit/tenant, see collections, outstanding rent. Filterable by date range, unit, tenant and property. Full CRUD.
- **Rent ledger** — per-tenant-per-month view of expected rent vs paid vs outstanding across any date range and property.
- **Configurable reports** — weekly **or** monthly income summaries over any date range and property, with per-property breakdowns and transaction drill-down.
- **Lease renewals** — every lease renews on its own frequency (configurable months); automated **renewal reminders** are sent before expiry (look-ahead configurable); one-click **renew with 10% rent increment**; notices can be sent on demand.
- **Water & electricity** — enter the **current and previous meter readings**; consumption and bill are computed automatically using configurable rates per unit (water per m³, electricity per kWh); mark bills paid. Pending utility balances are included in rent-due messages.
- **SMS & email notifications** — Africa's Talking SMS + SMTP email (zero extra dependencies), with delivery status tracked per message; test integration from Settings; messages are *simulated* when no credentials are configured.
- **Audit trail** — every major action (login, creates, edits, deletes, payments, readings, renewals, notifications, settings changes) is logged with who, what, when and why.
- **Reason-mandated deletes** — deleting any record requires an explanation + confirmation; the reason is stored in the audit trail.
- **Full CRUD everywhere** — properties, units, tenants, leases, payments and meter readings can all be added, edited and deleted.
- **Mobile-ready (PWA)** — installable from Safari/Chrome and works on any phone: the sidebar becomes a swipeable **bottom tab bar** below 760px and tables stack into labelled cards below 600px.

## Default login
| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin (manages users) |

Change it after first login via the sidebar → **Change password**.

## Roles
- **Admin** — everything, plus the **Users** tab (add/edit/disable/delete users).
- **Manager** — all business features (properties, units, tenants, onboarding, payments, reports, renewals, utilities, notifications, activity, settings) but cannot manage users.

## Documentation
- **[USER_MANUAL.md](./USER_MANUAL.md)** — day-to-day usage of every screen and task.
- **[CONFIGURATION.md](./CONFIGURATION.md)** — starting the app, user accounts & roles, settings, SMS/email integrations, backup & reset.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — hosting the system online for demos (Render, free).
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — common problems and their fixes.

## Stack
- Backend: Node.js (Express) + SQLite (`better-sqlite3`)
- Frontend: React 18 + Vite

## Quick start

```bash
npm run install:all     # install server + client dependencies
npm run dev             # starts API (:4000) and web app (:5173)
```

Then open **http://localhost:5173**.

> Requires Node 16+. The first run seeds the database automatically with the 3 properties (48 units) and sample tenants/leases/payments.

## Manual start (two terminals)

```bash
# terminal 1 — API
cd server && npm run dev

# terminal 2 — web app
cd client && npm run dev
```

## Reset / re-seed demo data

```bash
rm -f server/data/estate.db* && npm run seed
```

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Sign in (public); returns a JWT |
| GET | `/api/auth/me` | Current signed-in user |
| POST | `/api/auth/change-password` | Change own password |
| GET/POST | `/api/users` | List / add users (admin) |
| PATCH/DELETE | `/api/users/:id` | Edit / delete user (admin) |
| GET/POST | `/api/dashboard` | Summary stats, recent payments, renewals due |
| GET/POST/PATCH/DELETE | `/api/properties` (/`:id`) | Property CRUD |
| GET/POST/PATCH/DELETE | `/api/units` (/`:id`) | Unit CRUD |
| POST | `/api/units/:id/vacate` | End active lease(s), mark unit vacant (reason required) |
| POST | `/api/onboarding` | Create tenant + lease in one step, occupy a unit |
| GET/POST/PATCH/DELETE | `/api/tenants` (/`:id`) | Tenant CRUD |
| GET/POST/PATCH/DELETE | `/api/leases` (/`:id`) | Lease CRUD |
| POST | `/api/leases/:id/renew` | Renew lease with +10% rent |
| PATCH | `/api/leases/:id/notice` | Send / mark renewal notice |
| POST | `/api/leases/:id/terminate` | End lease, set unit vacant |
| GET/POST/PATCH/DELETE | `/api/payments` (/`:id`) | Rent payment CRUD (with date/unit/tenant/property filters) |
| GET | `/api/reports/summary` | Weekly or monthly totals (`period=weekly\|monthly`, `from`, `to`, `property_id`) |
| GET | `/api/reports/period` | Transactions + property breakdown for one period (`key=YYYY-MM` or week start) |
| GET | `/api/reports/rent-ledger` | Per-tenant-per-month expected vs paid vs outstanding (`from`/`to` as YYYY-MM) |
| PATCH/DELETE | *(all deletes)* | Body `{"reason": "…"}` is required for every DELETE |
| GET/PUT | `/api/settings` | Renewal look-ahead, utility rates, SMS/email provider settings (masked) |
| GET | `/api/notifications` | Recorded SMS/email messages with delivery status |
| GET | `/api/notifications/stats` | Message counts by channel & status |
| POST | `/api/notifications` | Send a notice for a lease (`lease_id`, `kind`) |
| POST | `/api/reminders/run` | Run automated renewal reminders now |
| POST | `/api/integrations/test` | Send a test SMS/email (`channel`, `recipient`) |
| GET | `/api/activity` | Audit trail (who / action / entity / reason / when) |
| GET/PUT | `/api/utility/rates` | Water / electricity rates |
| GET/POST/PATCH/DELETE | `/api/readings` (/`:id`) | Meter reading CRUD; POST computes previous reading, consumption & amount |

## Project layout

```
server/            Express API + SQLite
  db.js            schema + migrations + seed data (incl. default admin user)
  index.js         auth middleware + all routes (full CRUD)
  reminders.js     message builders + automated reminder engine + test messages
  providers.js     zero-dependency SMS (Africa's Talking) + email (raw SMTP) clients
client/            React + Vite web app
  src/pages/       Login, Account, Dashboard, Properties, Units, Onboarding,
                   Tenants, Payments, Reports, Renewals, Utilities,
                   Notifications, Activity, Settings, Users
  src/components/  Modal, ConfirmDelete, ReceivePayment, OnboardingModal
```