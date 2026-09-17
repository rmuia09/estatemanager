# Estate Manager — User Manual

A guide to the **day-to-day usage** of the Estate Manager rental management system —
signing in, working with the screens and completing the common tasks you perform every
month.

> **Related documents**
> - [CONFIGURATION.md](./CONFIGURATION.md) — starting the app, user accounts, SMS/email
>   integrations and system settings.
> - [DEPLOYMENT.md](./DEPLOYMENT.md) — putting the system online for demos (Render).
> - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — what to do when something doesn't work.

---

## Table of contents

- [Quick reference — manual vs. automatic](#quick-reference--manual-vs-automatic)
- [Using the app on a phone](#using-the-app-on-a-phone)
1. [Signing in](#1-signing-in)
2. [The dashboard](#2-the-dashboard)
3. [Properties](#3-properties)
4. [Units](#4-units)
5. [Tenants](#5-tenants)
6. [Onboarding — moving a tenant in](#6-onboarding--moving-a-tenant-in)
7. [Rent payments](#7-rent-payments)
8. [Reports & the rent ledger](#8-reports--the-rent-ledger)
9. [Lease renewals](#9-lease-renewals)
10. [Water & electricity bills](#10-water--electricity-bills)
11. [Notifications message history](#11-notifications-message-history)
12. [Activity & audit trail](#12-activity--audit-trail)
13. [Deleting records safely](#13-deleting-records-safely)
14. [The Visitors page (admins)](#14-the-visitors-page-admins)

The *left-hand sidebar* contains every section (on a phone it becomes the **bottom tab
bar** — see [Using the app on a phone](#using-the-app-on-a-phone)). Admin accounts also
see a **Users** and a **Visitors** tab — see [CONFIGURATION.md](./CONFIGURATION.md#users--roles)
for managing accounts, and [The Visitors page](#14-the-visitors-page-admins) for site
traffic.

---

## Quick reference — manual vs. automatic

### You do these **manually**
| Task | Where |
|---|---|
| Sign in / sign out, change your password | Sidebar |
| Add / edit **properties, units, tenants** | Corresponding pages |
| Onboard a new tenant (tenant + lease + occupy in one step) | **Onboarding** page |
| Record **rent payments** | Rent Payments / a unit's row |
| Enter **meter readings** (water & electricity) | Utilities page |
| Mark utility bills **paid** | Utilities page |
| **Send a renewal notice** or **renew a lease** | Lease Renewals page |
| Delete / vacate any record (reason required) | Delete / Vacate buttons |
| Configure settings & integrations | Settings page (see CONFIGURATION.md) |
| Manage user accounts (admin only) | Users page (see CONFIGURATION.md) |

### The system does these **automatically**
| Task | Details |
|---|---|
| Create & seed the database on first run | 3 properties, 48 units + sample data, `admin`/`admin123` |
| Send **renewal reminders** | Runs at server start and every **6 hours**; targets active leases expiring within the look-ahead that haven't been notified yet |
| Skip already-notified leases | `notice_sent` is flagged once a reminder goes out — no duplicates |
| Compute **consumption & bill** from readings | Previous vs. current reading × rate |
| Include pending utility balances | Added into rent-due and renewal-reminder messages |
| Calculate the **+10% renew rent** | Applied when you click **Renew +10%** |
| Compute the **rent ledger** (expected vs. paid vs. outstanding) | Rent Payments → Load ledger |
| Totals & **report breakdowns** | Weekly/monthly summaries + per-property + drill-down |
| **Log every action** to the audit trail | Who, what, when and why (incl. reasons) |
| Mask stored secrets | SMS key / email password shown as `••••` — never returned |

### Integrations — automatic vs. manual
| Integration | Automatic | Manual |
|---|---|---|
| **SMS — Africa's Talking** | Renewal reminders are sent automatically (every 6 h) to every due tenant who has a **phone** on file (once SMS is **enabled** in Settings) | Configuring username/API key/sender in Settings; sending a **rent-due** notice or a **test** message |
| **Email — SMTP** | Renewal reminders are sent automatically to every due tenant who has an **email** on file (once Email is **enabled** in Settings) | Configuring SMTP host/port/credentials in Settings; sending a **rent-due** notice or a **test** message |
| **M-Pesa** | None — M-Pesa is **not** connected to the system | You record each M-Pesa payment manually in Rent Payments (same as Cash / Bank); the system does **not** link to M-Pesa or reconcile automatically |

> **How notifications flow:** a reminder/notice is attempted on **every channel the tenant
> has** (phone → SMS, email → Email). Channels that are disabled or unconfigured fall back
> to **simulated** mode (recorded, nothing actually sent) — see
> [CONFIGURATION.md → Simulated mode](./CONFIGURATION.md#9-test-messages--simulated-mode).
> The only automatic *sender* is the renewal-reminder engine; rent-due notices and test
> messages are always triggered by you.

---

## Using the app on a phone

The system is **mobile-friendly** (a progressive web app — PWA). Everything works in the
phone's browser, and on screens narrower than ~760px the layout adapts:

- **The menu is a bottom tab bar.** The left-hand sidebar moves to a horizontal row of
  icon + label buttons fixed at the bottom of the screen. **Swipe the bar left/right** to
  see all the sections; the active one is highlighted.
- **Tables become cards.** Below ~600px every table row stacks into its own card with the
  column name next to each value (e.g. `Rent/month — KES 8,500`), so nothing needs a
  sideways scroll.
- **Install it like an app (optional).**
  - *iPhone/iPad (Safari):* open the site → tap **Share** → **Add to Home Screen** →
    **Add**. It appears as an app icon that opens full-screen, without the browser bar.
  - *Android (Chrome):* tap the **⋮** menu → **Install app**.
  - Installing needs the site served over **HTTPS** — the deployed demo
    ([DEPLOYMENT.md](./DEPLOYMENT.md)) is.

> **I see only the dashboard — where are the menus?** If the site looks like the desktop
> version (or the bottom tab bar is missing), Safari may be loading it in **desktop
> mode** or showing a stale copy. In Safari tap **aA** → **Website Settings** → turn
> **OFF "Request Desktop Website"** → **Done** → reload. If it still looks stale, clear
> the site's data: **Settings → Safari → Advanced → Website Data** → delete the site.

---

## 1. Signing in

1. Open the web app (see CONFIGURATION.md → Starting the app) and enter your
   **username** and **password**.
2. Click **Login**.

Your **role** (admin or manager) decides what you see and can do — see
[Users & roles](./CONFIGURATION.md#users--roles).

### Changing your password
1. Click **Change password** in the bottom-left panel (under your name).
2. Enter your current password, then the new one (6+ characters) and confirm.

### Logging out
Click **Logout** in the bottom-left panel. Logins and logouts are recorded in the
[Activity](#12-activity--audit-trail) trail.

### Automatic logout (idle timeout)
For safety, the system signs you out automatically after **3 minutes without
activity** (any click, keypress, tap, scroll or swiping). You'll be returned to the
**Sign in** screen and can log straight back in. The server session also expires a
maximum of **12 hours** after login regardless of use.

---

## 2. The dashboard

The dashboard is a one-glance overview:

- **Total units**, **Occupied** (and **vacant**) units
- **Expected rent/month** — from all active leases
- **Collected this month** — payments received this month, and the **% of expected**
- **Outstanding this month** — rent not yet paid
- **Pending utility bills** — total unpaid water & electricity amounts
- **Recent payments** — last 12 payments (type to filter; **View all** opens Rent Payments)
- **Lease renewals due** — leases expiring in the next 60 days (type to filter;
  **Manage** opens Lease Renewals)

Click any card's **View all / Manage** button to open the full section.

---

## 3. Properties

A **property** is a building or estate block with its own units (e.g. *Melon Park*,
*Block 13*, *Block 3*).

### Viewing & searching
- The table lists every property with its **location**, **total units**, **occupied**
  and **vacant** counts.
- **Search property / location…** — type to filter as you go.
- **All / Has vacancies / Fully occupied** — show only properties with vacant units, or
  only full ones.
- **Clear** — resets all filters.

### Adding a property
1. Click **+ Add property**.
2. Enter the **Name** (required) and **Location** (optional).
3. Click **Add property**.

### Editing & deleting
- **Edit** — change the name or location, then **Save changes**.
- **Delete** — see [Deleting records safely](#13-deleting-records-safely). Deleting a
  property also deletes all its **units, leases, payments and meter readings**.

---

## 4. Units

A **unit** is a rentable space inside a property (e.g. *A1*, *13-04*). It is either
**occupied** (has an active lease) or **vacant**.

### The table
Shows property, unit number, type, current **tenant** and contact, **rent/month**, lease
end date, and **status**.

### Searching & filtering
- **Search unit / tenant / phone…** — text filter.
- **All properties** — restrict to one property.
- **All statuses** — Occupied or Vacant.
- **Clear** — resets everything.

Compact chips above the table summarise occupancy per property (e.g. `Melon Park: 32/32`).

### Adding a unit
1. Click **+ Add unit**.
2. Choose the **Property** and enter a **Unit number** (both required).
3. Set the **Type**, **Monthly rent**, and **Status**.
4. Click **Save unit**.

### Occupying a unit (moving a tenant in)
1. Click **Occupy** on the unit's row.
2. Complete the onboarding form (see
   [Onboarding](#6-onboarding--moving-a-tenant-in)) — tenant, start date, rent,
   renewal frequency.
3. The unit is marked occupied and a lease is created.

### Vacating a unit (moving a tenant out)
1. Click **Vacate** on the unit's row.
2. Read the confirmation (it shows the current tenant and lease end date).
3. **Enter a reason** (required) and confirm.
4. The active lease ends, the tenant stays on record, the unit becomes **vacant**.
   The action appears in the [Activity](#12-activity--audit-trail) trail.

### Deleting a unit
Deleting a unit removes it and all linked leases, payments and readings — see
[Deleting records safely](#13-deleting-records-safely).

---

## 5. Tenants

A **tenant** is a person renting (or who has rented) a unit.

### The table
Shows name, phone, email, **active leases** and **total leases**. Tenants with linked
leases cannot be deleted (the Delete button is disabled).

### Searching & filtering
- **Search name / phone / email…** — text filter.
- **All tenants / Has active lease / No active lease** — status filter.
- **Clear** — resets.

### Adding & editing
- **+ Add tenant** — add a person ahead of a move-in.
- **Edit** — update a tenant's stored details.

> New move-ins normally go through [Onboarding](#6-onboarding--moving-a-tenant-in),
> which creates tenant + lease + occupancy in one step.

---

## 6. Onboarding — moving a tenant in

The **Onboarding** page handles move-ins in one form: it creates the tenant, the lease
and marks the unit **occupied**.

Open **Onboarding** in the sidebar → **+ Onboard new tenant**. The form has three parts:

1. **Pick a unit**
   - **Use an existing vacant unit** — choose from the dropdown (rent hint is
     pre-filled). If nothing is vacant, tick **Create a new unit**.
   - **Create a new unit** — pick the property, enter the unit number and type.
2. **Tenant details** — full name (required), phone, email.
3. **Lease terms**
   - **Date of joining**
   - **Lease duration (months)**
   - **Initial rent (KES/mo)**
   - **Renewal frequency (months)** — how often the lease renews; this drives the
     automated renewal reminders.

A preview box confirms the duration, rent and renewal frequency before you save.

Click **Occupied — save tenancy**. A success card shows the created tenancy (tenant,
unit, from–to, rent, renewal frequency). The unit is now occupied and reminders for this
lease are scheduled automatically.

> Onboarding refuses an already-occupied unit.

---

## 7. Rent payments

The **Rent Payments** page records and searches all rent income.

### Recording a payment
1. Open Rent Payments (or use **Receive payment** on a unit's row on the Units page).
2. Choose the **unit/tenant**, enter the **amount** (KES), the **date**, and the
   **method** (Cash / M-Pesa / Bank / other) with optional notes.
3. Save — the payment appears in the ledger and reports.

### Searching & filtering payments
- **Search tenant / unit / phone…** — free text.
- **Property**, **Unit**, **Tenant** drop-down filters.
- **From / To** dates — restrict to a window.
- **Clear** — resets. A **filtered total** card shows the sum of the current view.

### Editing & deleting
- **Edit** on a row — change amount/date/method/notes.
- **Delete** — requires a reason (see [Deleting](#13-deleting-records-safely)).

### The rent ledger
Below the payment list: **Rent ledger** card.

1. Choose the **from** and **to** months (defaults to this month and 6 months back).
2. Optionally restrict to a **property** and search for a **tenant**.
3. Click **Load ledger**.

Each tenant row lists one column per month with the **expected** rent, **paid** and the
**outstanding** balance (shown in red). Totals for expected / paid / outstanding sit at
the end of each row.

---

## 8. Reports & the rent ledger

The **Reports** page shows income collected across the estate.

### Weekly or monthly
Use the **Weekly / Monthly** toggle.

### Filtering
- **Date range** — two date/month pickers (e.g. `2026-09` → `2026-11`).
- **All properties / <property>** — restrict to one property.
- **Apply** — reload the report.

### Reading the report
- **Total collected** — the grand total for the chosen window.
- **Bars** — one bar per week/month; click a bar to load that period's transactions.
- **Table** — transactions count and total per period, with a **Detail** button per row.

### Period breakdown
The **Breakdown** card (from a bar or the Detail button) shows:
- the period total,
- a **By property** split (payments + amount per property),
- every **transaction** (date, property, unit, tenant, method, amount).

---

## 9. Lease renewals

Every lease has an **end date** and a **renewal frequency** (months). The Renewals page
tracks what's coming up.

### Sections
- **Overdue renewals** — leases past their end date.
- **Due within 60 days** — renewals approaching, showing the new (+10%) rent.
- **All active leases** — every current lease.

Rows show property, unit, tenant, phone, current rent, **end date**, days left, whether
the **notice** was sent, and the **new rent (+10%)**.

### Actions per lease
- **Send notice** — sends/records the renewal notification (see
  [Notifications](#11-notifications-message-history)).
- **Edit** — adjust dates or rent.
- **Renew +10%** — creates a new lease starting the day after expiry with a **10% rent
  increment**, using the lease's renewal frequency. The old lease is marked *renewed*,
  the unit rent updates, and reminders reset for the new lease.
- **End** (terminate) — ends the lease now and marks the unit vacant (tenant stays on
  record).
- **Del** — permanently deletes the lease record (reason required).

### Manual tenancy creation
**+ New tenancy** assigns a vacant unit and an existing tenant with dates and rent — the
fallback when Onboarding isn't needed.

---

## 10. Water & electricity bills

The **Utilities** page manages meter readings for water (m³) and electricity (kWh).

### Recording a reading
1. Pick **Water** or **Electricity**, then the **unit**.
2. Set the **reading date** and enter the **current reading**.
3. The **rate** is pre-filled from settings (editable per reading).
4. The preview shows the **previous reading**, **consumption** and computed **bill**.
5. Click **Save reading**.

The system compares against the previous reading for the same unit and utility, and
computes consumption and the bill automatically. A reading lower than the previous one
is rejected.

### Managing bills
- **Mark paid** — a pending bill becomes paid.
- **Edit** — change the rate or status.
- **Del** — remove the reading (reason required).

### Searching readings
The **Readings history** table filters by:
- **Search unit / property…** (text)
- **All properties / All utilities (Water|Electricity) / All statuses (Pending|Paid)**

> Pending utility balances are included inside the **rent-due** and **renewal-reminder**
> messages sent to tenants.

---

## 11. Notifications message history

The **Notifications** page shows every SMS/email message the system has recorded, with
its delivery status.

Each row shows:
- **Time** sent, **Channel** (SMS / Email), **Kind** (reminder / rent due / test)
- **Recipient**, **Tenant / Unit**
- **Status** badge — `sent`, `simulated`, or `failed`, plus the provider message ID

Click a row to expand the full **Subject** and **body**.

### Filtering
- **Search recipient / tenant…**
- **All kinds** — Reminder / Rent due / Test
- **All statuses** — Sent / Simulated / Failed

### Summary cards
Count messages by **status + channel** (e.g. `4 simulated SMS`).

> **▶ Run automated reminders now** triggers the reminder pass on demand; automatic
> reminders run on their schedule (see
> [Configuration](./CONFIGURATION.md#automated-renewal-reminders)).

---

## 12. Activity & audit trail

The **Activity** page is the chronological audit log of major actions by every user.

For each entry: **When**, **User**, **Action** (e.g. `login`, `create`, `delete`,
`record_payment`, `renew`, `reminders`), **Entity** (e.g. `payment #123`), **Reason**
(always present for deletes) and **Details** (amounts, units, names).

### Filtering
- **Search user, action, entity, reason…**
- **All action types** — restrict to one action type.

---

## 13. Deleting records safely

**Every delete requires a reason.** This protects records and keeps a complete audit trail.

1. Click the **Delete** (or **Del**) button.
2. A confirmation dialog describes exactly what will be removed.
3. **Enter a reason** (required) — e.g. *"Tenant vacated"*, *"Data entry error"*,
   *"Rent payment recorded twice"*.
4. Confirm.

The reason, user, time and affected record are stored permanently in the
[Activity](#12-activity--audit-trail) trail. The same rule applies to **vacating units**.

> Deletes are immediate and permanent — there is no recycle bin. Deleting a property or
> unit removes all linked leases, payments and readings.

For user-account administration (creating users, roles, disabling accounts), see
[Users & roles](./CONFIGURATION.md#users--roles).

---

## 14. The Visitors page (admins)

The **Visitors** tab (admin accounts only) shows who has been opening the site and how
often — useful for checking whether tenants, agents or partners are actually visiting
your portal, and for demo day.

Every time someone loads a page in the browser, that single page-load is recorded — this
page carries no tracking scripts, cookies or third-party analytics; it only reads the
requests the browser already makes. What is stored is minimal: the page opened, the IP
address the request came from, the browser/device type and the time. A **Visitors** tab
does not appear for, and `/api/visits` is blocked for, manager accounts.

The page shows:

- **Summary cards** — *Total page loads*, *Unique visitors* (counted by IP) and *Last
  24 hours*.
- **Daily views (30 days)** — a bar chart of page loads per day, with the number of
  unique visitors on hover.
- **Top pages** — the 10 most-opened pages with their load counts.
- **Recent visits** — the latest entries with **When**, **IP**, **Path**, **Device**
  (phone / tablet / desktop / bot) and **Browser**.

### Pagination on long tables

Most lists in the app (units, tenants, payments, renewals, utilities, notifications,
activity, users and visits) are **paginated**: they show **20 rows per page**, and when
there are more you get **‹ Prev** and **Next ›** buttons plus a *“1–20 of 157”* counter
below the table. Searching, filtering or clearing filters always returns you to **page 1**.