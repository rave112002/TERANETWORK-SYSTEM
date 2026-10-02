# Project status

**Updated:** 2026-10-03 · Keep this page to one screen. Update it whenever something moves.

## What the system is

A billing and network admin system for **TERANETWORK**, an internet provider. **Each branch runs
its own copy** (own server, own database) — [D7](decisions.md#d7--one-branch-per-installation).
**One central SuperAdmin** on the developer's PC manages every branch over Tailscale —
[D10](decisions.md#d10--one-central-superadmin-over-tailscale).

```
Customer signs up → subscription → ONU provisioned on the OLT
  → invoice on the 25th (due the 2nd) → customer pays by GCash → staff record it (reference no.)
  → unpaid after the due date → disconnected at the OLT → pays → reconnected
  → 60 days suspended → modem pulled out
```

## ✅ Two-PC deployment rehearsal passed (2026-10-02)

A clean second PC set up as a branch from nothing, following [deployment-steps.md](deployment-steps.md),
and managed from the SuperAdmin PC over Tailscale (Windows, Node 22, MySQL 8.0.45, NSSM 2.24-101).
Full results: [rehearsal-status.md](rehearsal-status.md).

- **Passed:** branch reachable only inside the tailnet · app + worker as Windows services · SuperAdmin
  shows it Online, creates the Owner, sets settings and company profile · role menus (Billing,
  Technician) · billing end to end with real invoice and receipt emails · GCash Check (a wrong
  amount is flagged) · reports + CSV · audit trail, SuperAdmin's actions included · branch PC
  restarted with nobody logged in · SuperAdmin PC off · MySQL killed, recovers by itself ·
  password reset from SuperAdmin ends the old session · backup restored into a scratch DB, counts match.
- **Found and fixed (2026-10-03):** five gaps in [deployment-steps.md](deployment-steps.md) (`npm ci`
  before `build:superadmin`, NSSM 2.24-101 via winget into System32, logs folder before `nssm set`,
  MySQL test by `taskkill` and `nssm start` after a manual stop, `mysqldump --result-file=` +
  `source` restore), plus the site notes. One worker bug: with MySQL down, `db.rollback()` was
  called on a connection that never opened. It now returns early, and the worker backs off
  3 s → 30 s while the queue keeps failing instead of logging every 3 s.

## ✅ Built and working

| Area | What |
| --- | --- |
| Customers | Plans, customers, subscriptions, pull-out / recovery after 60 days |
| Network | OLTs, PON ports, splitters, NAPs, ONUs, topology, discovery (OLT side) |
| Billing | Invoices on the 25th, adjustments (one subscription or **many at once**), invoice email, record payment. Invoice PDF in the **client's existing layout**, viewable in a drawer (**View PDF**) without downloading |
| Payments | **Personal GCash + GCash Check** (statement PDF upload, typo detection) — [payments.md](payments.md) |
| How to pay | GCash number, account name, Facebook page and **Terms and conditions** set in **Settings → How customers pay**, printed on every invoice PDF (and the payment steps on every billing email) |
| Email sending | Invoices go by email only, **never without the PDF**. Emails in the last 24 h vs the Gmail limit: Admin → System, Dashboard alert, SuperAdmin → Branches |
| Collections | Dunning sweep after the due date, exemptions, automatic reconnection on payment |
| **Real OLT** | The system suspended, restored and read 1/27 on the bench HSGQ XE04I itself (2026-09-24): blacklist + read-back + save, every step verified from the OLT's own tables. Discovery read all 60 ONUs on PON 1. [Transcript](vendor-transcripts/hsgq-xe04i/system-driven-2026-09-24.md) |
| Admin | Dashboard with "needs attention", reports, users & roles, audit trail, runbooks |
| **Billing-only branches** | SuperAdmin → System Settings → **Network features** off: a branch runs customers, plans, subscriptions (no modem needed), invoices, payments, GCash Check, reports; no OLT, no disconnections, no modem recovery. Same build; switch back on any time. Checked end to end on dev data (2026-09-28) — [D11](decisions.md#d11--a-billing-only-branch-the-network-switch) |
| **Central SuperAdmin** | **Branches** (health, version, warnings), **Company Profile** (logo, TIN), **Users** (Owner/Admin logins, password reset), **System Settings** (dry-run, billing schedule). Changes audited on the branch as `system:superadmin:<user>`. Old in-branch `/superadmin` removed. See [superadmin-server/README.md](../superadmin-server/README.md) |

## ⚠️ Built but not proven on the real thing

| What | Why it matters |
| --- | --- |
| **OLT: an ONU that comes back under a new ID** | Blacklisting deletes the ONU's binding. On restore the OLT re-binds it at the lowest free ID, which need not be its old one. Suspend, restore and status all work by MAC, so nothing acts on the wrong ONU. But the stored `onuIndex` isn't updated, so the screen shows a stale ID. 1/27 kept its ID on the bench. Small fix (next, item 2). |
| **OLT: suspending with other ONUs online** | Only one ONU was online on the bench PON. The blacklist is by MAC, so neighbours shouldn't be affected, but it hasn't been seen. |
| **GCash Check on longer statements** | Checked on one real 1-page statement (7 rows, 2026-09-17): all rows, references, directions and the credit total read correctly. Not yet seen: a multi-page statement. Run `npm run gcash:inspect` on one when available. |
| **Emails landing in spam** | In the rehearsal the receipt email (Gmail → Gmail) went to spam. Customers may miss invoices. Use the client's Gmail and ask customers to save the address; a domain email with SPF/DKIM later. |

## ⏳ Waiting on the client

| Need | Unblocks |
| --- | --- |
| **MikroTik** router IP, RouterOS version, login — and what the old Sheets→MikroTik step changed | Reconnecting on the router, if it's needed beyond the OLT |

## ▶️ Next, in order (before go-live)

1. **Customer import** from the client's subscriber spreadsheet — the biggest go-live gap.
2. **Follow an ONU's new ID**: when a status read finds the ONU by MAC under a different
   PON/ONU, update `onuIndex` (and log it), so what staff see matches the OLT.
3. **Automatic backups** (mysqldump `--result-file` + Task Scheduler, per the deployment doc).
4. **Per installation:** follow [deployment-steps.md](deployment-steps.md) on the client's PC
   (fresh database, the client's Gmail, real branch name). Install to `C:\TERANETWORK`; the PC
   must reach the network before Windows login (Ethernet, or Wi-Fi set to connect automatically).
5. `npm run gcash:inspect` on a multi-page statement when one is available.

✅ Done 2026-09-28: **Express serves the React build on :8787** — one process, one address
(`back`: `npm run serve` builds `front` and starts). Checked in Chrome: pages, login, invoice PDF.
The login is at **`/`** in both apps (branch and SuperAdmin); old `/admin` links land there.
Production mode now works over plain http from other devices (Tailscale IP): the CSRF cookie is
Secure only when the server is on HTTPS (`certPath` or `COOKIE_SECURE=true`).

## ⏸️ Parked (code kept, don't build on it)

- **HitPay** online checkout, and **GCash for Business** merchant QR — [D8](decisions.md#d8--gcash-business-merchant-qr-on-the-invoice-option-a-hitpay-parked)
- **Multi-branch business features** (cross-branch reports, shared data). Each branch is standalone; only SuperAdmin spans them ([D7](decisions.md#d7--one-branch-per-installation), [D10](decisions.md#d10--one-central-superadmin-over-tailscale)).
- **SMS** invoices and notices — parked 2026-09-28; invoices go by email only (with the PDF attached).
- Outage credits, alert emails, data export/anonymise — not started, not needed yet.

## Where things are

| | |
| --- | --- |
| Decisions (why things are the way they are) | [decisions.md](decisions.md) |
| Deploying a branch, step by step (and the two-PC rehearsal) | [deployment-steps.md](deployment-steps.md) |
| Two-PC rehearsal results (2026-10-02) | [rehearsal-status.md](rehearsal-status.md) |
| How it is deployed (branches, SuperAdmin, Tailscale) | [isp-invoice-generator-deployment-multibranch.md](isp-invoice-generator-deployment-multibranch.md) |
| Payments, day to day | [payments.md](payments.md) |
| What to do when something breaks | [runbooks.md](runbooks.md) |
| The old migration plan and 1,800-line checklist | [archive/](archive/) (history only) |
