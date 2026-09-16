# Estate Manager — Configuration Guide

Setup and configuration for **Estate Manager**: starting the app, user accounts and
roles, system settings, and the SMS/email notification integrations.

> **Related documents**
> - [USER_MANUAL.md](./USER_MANUAL.md) — day-to-day usage of the system.
> - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — fixing common problems.

---

## Table of contents

1. [Starting the app](#1-starting-the-app)
2. [Default login & initial password](#2-default-login--initial-password)
3. [Users & roles](#3-users--roles)
4. [The Settings page](#4-the-settings-page)
5. [Automated renewal reminders](#5-automated-renewal-reminders)
6. [Utility rates](#6-utility-rates)
7. [SMS integration (Africa's Talking)](#7-sms-integration-africas-talking)
8. [Email integration (SMTP)](#8-email-integration-smtp)
9. [Test messages & simulated mode](#9-test-messages--simulated-mode)
10. [Backup & reset](#10-backup--reset)

---

## 1. Starting the app

Requirements: **Node.js 16+** and **npm**.

From the project folder:

```bash
npm run dev
```

This starts:
- the **web app** at **http://localhost:5173** — open in your browser
- the **API server** on port **4000** — used by the app

Two-terminal alternative:

```bash
# terminal 1 — API
cd server && npm run dev
# terminal 2 — web app
cd client && npm run dev
```

> ⚠️ The API server loads its code **once at start**. If the code changes (e.g. after an
> update), restart with `Ctrl+C` and run `npm run dev` again, or new features/report
> endpoints will appear missing (see TROUBLESHOOTING.md).

The database file lives at **`server/data/estate.db`** and is created automatically with
demo data (3 properties, 48 units, sample tenants/leases/payments) the first time it runs.

---

## 2. Default login & initial password

The first run creates an **admin** account:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |

> ⚠️ **Change the default password immediately after first login**: sidebar → **Change
> password**. Enter the current password and a new one (6+ characters).

Passwords are stored hashed. If the password is lost, reset the demo data (see
[Backup & reset](#10-backup--reset)) — this restores `admin` / `admin123`.

---

## 3. Users & roles

Only a **User** account with the **admin** role can open the **Users** tab.

### Roles

| Role | Access |
|---|---|
| **Admin** | Everything, including the Users tab |
| **Manager** | All business features (properties, units, tenants, onboarding, payments, reports, renewals, utilities, notifications, activity, settings). Cannot manage users. |

### Creating a user
1. Open **Users** (admin only) → **+ Add user**.
2. Enter **username**, **full name**, **password** (6+ chars) and a **role**.
3. Click **Add user**.

### Editing / passwords
- **Edit** — change the full name or role, or set a new password (leave blank to keep the
  current one).

### Disabling & deleting
- **Disable / Enable** — block a user from signing in without deleting the account.
- **Delete** — remove the user (a reason is required).

### Safety rules
- An admin **cannot delete themselves**.
- The **last remaining admin** cannot be removed.

---

## 4. The Settings page

The **Settings** page (⚙️ in the sidebar) controls three areas:

1. **Lease renewals** — renewal-reminder look-ahead (see below).
2. **Utility rates** — water & electricity cost per unit.
3. **SMS / email integrations** — notification providers and test messages.

After changing values click **Save settings**. Changes apply immediately and are recorded
in the [Activity](./USER_MANUAL.md#12-activity--audit-trail) trail.

---

## 5. Automated renewal reminders

- **Send expiry reminders N months ahead** (`renewal_reminder_months`, default **2**)
  sets how early the engine looks for expiring leases.
- The engine targets **active** leases that expire within the look-ahead **and** haven't
  been notified yet (`notice_sent` = false).
- Runs automatically on **server start** and every **6 hours**. It can also be triggered
  manually from the Notifications page (**▶ Run automated reminders now**).
- Each lease also carries its own **renewal frequency** (months) — set at
  [onboarding](./USER_MANUAL.md#6-onboarding--moving-a-tenant-in) or when editing a
  lease — which is used in the reminder text and on renew.

---

## 6. Utility rates

Set the cost per unit on the **Settings** page (or the **Utility rates** card on the
**Utilities** page):

- **Water** — KES per m³
- **Electricity** — KES per kWh

These are defaults; an individual reading can override its rate.

---

## 7. SMS integration (Africa's Talking)

On the **Settings** page, under **SMS — Africa's Talking**:

1. Toggle **Send SMS notifications** on.
2. Enter your **Username** and **API key** from your Africa's Talking account.
3. Optionally set a **Sender ID** (e.g. `EstateManager`).
4. Leave **Sandbox mode** on for testing, or switch to **Live** when ready.

Notes:
- Sandbox mode uses Africa's Talking's sandbox endpoint (free, no real SMS sent).
- The API key is masked after saving (`••••••••`). Leave the field blank to keep the
  existing key — it is never returned by the system.

---

## 8. Email integration (SMTP)

On the **Settings** page, under **Email — SMTP**:

1. Toggle **Send email notifications** on.
2. Enter the **SMTP host**, **Port** (587 with STARTTLS, or 465 for direct TLS),
   **Username**, **Password** and **From address** (e.g. `Estate Manager
   <no-reply@example.com>`).

Any standard SMTP account works (hosted mail, Gmail app passwords, Zoho, etc.). The
password is masked after saving; leave blank to keep it.

---

## 9. Test messages & simulated mode

**Send a test** (Settings → **Send a test message**):
1. Choose the **channel** (SMS or Email).
2. Enter a **recipient** (phone for SMS, email address for Email).
3. Click **Send test**.

The result badge shows **Sent ✓**, **Simulated ✓** or **Failed ✗** with the error. Test
messages are recorded on the Notifications page and in the activity trail.

### Simulated mode
Until real credentials are configured, every message is marked **simulated**:

- No real SMS/email is sent and nothing is charged.
- Delivery is still recorded so you can preview exactly what would be sent.
- Once credentials are added and the channel is enabled, messages switch to **sent** /
  **failed** automatically.

---

## 10. Backup & reset

### Backup
All data lives in one file: **`server/data/estate.db`**.

Stop the server (optional, for full consistency) and copy the file:

```bash
cp server/data/estate.db server/data/estate.db.bak
```

### Reset / re-seed demo data
Restores the demo dataset and a fresh `admin` / `admin123` account:

```bash
rm -f server/data/estate.db* && npm run seed
```

> ⚠️ This **wipes all recorded data**. Deleting only the `.db` files (without the
> `-wal`/`-shm` sidecars) can cause a corrupted database — always remove them together.