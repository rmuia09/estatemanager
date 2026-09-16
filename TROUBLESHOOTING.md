# Estate Manager — Troubleshooting Guide

Common problems, what they mean, and how to fix them.

> **Related documents**
> - [USER_MANUAL.md](./USER_MANUAL.md) — day-to-day usage of the system.
> - [CONFIGURATION.md](./CONFIGURATION.md) — starting the app, accounts, and integrations.

---

## Table of contents

1. [The app won't start](#1-the-app-wont-start)
2. ["Not Found" on pages or after a feature update](#2-not-found-on-pages-or-after-a-feature-update)
3. [Can't reach the app at all](#3-cant-reach-the-app-at-all)
4. [New features / report endpoints missing](#4-new-features--report-endpoints-missing)
5. [Login problems](#5-login-problems)
6. [SMS shows "simulated" and no message arrives](#6-sms-shows-simulated-and-no-message-arrives)
7. [Emails fail to send](#7-emails-fail-to-send)
8. [Renewal reminders never arrive](#8-renewal-reminders-never-arrive)
9. [Reading rejected as "lower than previous"](#9-reading-rejected-as-lower-than-previous)
10. [Port already in use](#10-port-already-in-use)

---

## 1. The app won't start

**Symptom:** `npm run dev` errors immediately.

- Check the **Node.js** version: `node -v` (needs 16+).
- Run `npm install` in the project root (and in `server/` / `client/` if freshly
  cloned).
- Read the full error — the most common cause is a **port already in use** (see
  [#10](#10-port-already-in-use)).

---

## 2. "Not Found" on pages or after a feature update

**Symptom:** A page loads but a section keeps returning **Not Found** (for example
Reports showing `404` on **summary / period / rent-ledger**).

**Cause:** The API server loads its code **once at startup**. If it was started before
new routes existed (or while an upload/update was in progress), it is still serving the
old code.

**Fix — restart the server:**

1. Stop it: `Ctrl+C` in the `npm run dev` terminal (or kill the process list).
2. Run `npm run dev` again.
3. Re-check the previously failing page.

> If you just updated or copied new code into the project, always restart before
> investigating anything else.

---

## 3. Can't reach the app at all

**Symptom:** Browser says "can't reach this page" for http://localhost:5173.

1. Confirm the server processes are running:
   ```bash
   ps aux | grep -E 'vite|node.*index'
   ```
2. If nothing is listed, the server isn't running — start it (see
   [CONFIGURATION.md](./CONFIGURATION.md#1-starting-the-app)).
3. Verify the ports respond:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173   # web app
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/auth/login
   ```
   The web app should return `200`; the API a response from the login endpoint.
4. If the ports listen but the page is broken, check the terminal log for errors and
   restart.

---

## 4. New features / report endpoints missing

**Symptom:** The web app has a new button/page, but the API responds **Not Found** for it
(e.g. Reports).

- The API needs a **restart** after code changes — see [#2](#2-not-found-on-pages-or-after-a-feature-update).
- After restarting, the affected page should work immediately.

---

## 5. Login problems

| Symptom | Likely cause | Fix |
|---|---|---|
| "Incorrect username or password" | Typo / wrong password | Re-type; watch for Caps Lock. Use **Change password** if forgotten (old password required). |
| User disabled | Account was disabled by an admin | Contact an admin to **Enable** the account (Users tab). |
| Password lost & no admin help | Data reset needed | Reset demo data — see [CONFIGURATION.md → Backup & reset](./CONFIGURATION.md#10-backup--reset). **Warning:** wipes all recorded data. |

---

## 6. SMS shows "simulated" and no message arrives

**Normal.** Until real Africa's Talking credentials are configured, every message is
recorded as **simulated** and nothing is actually sent — this is by design
([CONFIGURATION.md → Simulated mode](./CONFIGURATION.md#9-test-messages--simulated-mode)).

To send real SMS:
1. Open **Settings → SMS — Africa's Talking**.
2. Set your **Username**, **API key** and a **Sender ID**.
3. Turn **Save** on (and switch **Sandbox** off when ready for live SMS).
4. Use **Send a test message** to confirm delivery.

If a test fails with credentials set:
- Double-check the API key and username.
- In **Sandbox mode**, ensure the recipient was added as an allowed sandbox number in your
  Africa's Talking dashboard.
- Verify the sender ID matches what your Africa's Talking account allows.

---

## 7. Emails fail to send

When the email badge shows **Failed ✗** with an error, check:

- **Authentication** — username/password wrong or the account requires an app-specific
  password (e.g. Gmail "app passwords").
- **Port/TLS** — most providers use port **587 + STARTTLS**; check which your provider
  requires.
- **From address** — must be allowed by the provider for the account.
- **Spam folder** — a successful send may land in spam.
- Once fixed, re-test from **Settings → Send a test message**.

---

## 8. Renewal reminders never arrive

1. **Reminders are simulated** until credentials exist — see [#6](#6-sms-shows-simulated-and-no-message-arrives).
2. Confirm the **look-ahead** setting is meaningful (Settings → *Send expiry reminders
   N months ahead*).
3. Confirm the lease's **end date** and **renewal frequency** are correct (Lease
   Renewals).
4. Confirm the lease is still **active** and not already marked *notified*.
5. Trigger the pass manually: **Notifications → ▶ Run automated reminders now**, then
   check the Notifications page for new entries.

Reminders run automatically at **server start** and every **6 hours** — an on-demand run
skips leases already notified.

---

## 9. Reading rejected as "lower than previous"

**Symptom:** Utilities refuses a water/electricity reading.

A new reading must be **≥ the previous reading** for the same unit + utility (meters
don't go backwards). If the previous reading was entered incorrectly:

1. **Edit** the previous reading (set it to a lower, correct value), or
2. Delete it (reason required), then re-enter the new reading.

---

## 10. Port already in use

**Symptom:** Startup error like `ENOTCONN` / `EADDRINUSE` / "address already in use" for
port **4000** or **5173** — usually a leftover instance of the app still running.

On macOS/Linux, find what holds the port:

```bash
lsof -nP -iTCP:4000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Kill the listed PID(s), then start fresh:

```bash
kill <pid> && npm run dev
```

> ⚠️ A stale server is often the exact cause of "old code still running" — restarting
> from a clean state fixes both the port conflict and missing endpoints at once.