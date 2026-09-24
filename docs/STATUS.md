# Project status

**Updated:** 2026-09-25 · Keep this page to one screen. Update it whenever something moves.

## What the system is

A billing and network admin system for **TERANETWORK**, an internet provider. **Each branch runs
its own copy** (own server, own database) — [D7](decisions.md#d7--one-branch-per-installation).
**One central SuperAdmin** on the developer's PC manages every branch over Tailscale —
[D10](decisions.md#d10--one-central-superadmin-over-tailscale).

```
Customer signs up → subscription → ONU provisioned on the OLT
  → invoice on the 15th → customer pays by GCash → staff record it (reference no.)
  → unpaid after the due date → disconnected at the OLT → pays → reconnected
  → 60 days suspended → modem pulled out
```

## ✅ Built and working

| Area | What |
| --- | --- |
| Customers | Plans, customers, subscriptions, pull-out / recovery after 60 days |
| Network | OLTs, PON ports, splitters, NAPs, ONUs, topology, discovery (OLT side) |
| Billing | Invoices on the 15th, adjustments, invoice email, record payment. Invoice PDF in the **client's existing layout**, viewable in a drawer (**View PDF**) without downloading |
| Payments | **Personal GCash + GCash Check** (statement PDF upload, typo detection) — [payments.md](payments.md) |
| How to pay | GCash number, account name, Facebook page and **Terms and conditions** set in **Settings → How customers pay**, printed on every invoice PDF (and the payment steps on every billing email) |
| Collections | Dunning sweep after the due date, exemptions, automatic reconnection on payment |
| **Real OLT** | The system suspended, restored and read 1/27 on the bench HSGQ XE04I itself (2026-09-24): blacklist + read-back + save, every step verified from the OLT's own tables. Discovery read all 60 ONUs on PON 1. [Transcript](vendor-transcripts/hsgq-xe04i/system-driven-2026-09-24.md) |
| Admin | Dashboard with "needs attention", reports, users & roles, audit trail, runbooks |
| **Central SuperAdmin** | **Branches** (health, version, warnings), **Company Profile** (logo, TIN), **Users** (Owner/Admin logins, password reset), **System Settings** (dry-run, billing schedule). Changes audited on the branch as `system:superadmin:<user>`. Old in-branch `/superadmin` removed. See [superadmin-server/README.md](../superadmin-server/README.md) |

## ⚠️ Built but not proven on the real thing

| What | Why it matters |
| --- | --- |
| **OLT: an ONU that comes back under a new ID** | Blacklisting deletes the ONU's binding. On restore the OLT re-binds it at the lowest free ID, which need not be its old one. Suspend, restore and status all work by MAC, so nothing acts on the wrong ONU. But the stored `onuIndex` isn't updated, so the screen shows a stale ID. 1/27 kept its ID on the bench. Small fix (next, item 2). |
| **OLT: suspending with other ONUs online** | Only one ONU was online on the bench PON. The blacklist is by MAC, so neighbours shouldn't be affected, but it hasn't been seen. |
| **GCash Check on longer statements** | Checked on one real 1-page statement (7 rows, 2026-09-17): all rows, references, directions and the credit total read correctly. Not yet seen: a multi-page statement. Run `npm run gcash:inspect` on one when available. |

## ⏳ Waiting on the client

| Need | Unblocks |
| --- | --- |
| **MikroTik** router IP, RouterOS version, login — and what the old Sheets→MikroTik step changed | Reconnecting on the router, if it's needed beyond the OLT |
| Do they send invoices by **SMS**? Through which provider? | SMS (only email exists) |

## ▶️ Next, in order (before go-live)

1. **Customer import** from the client's subscriber spreadsheet — the biggest go-live gap.
2. **Follow an ONU's new ID**: when a status read finds the ONU by MAC under a different
   PON/ONU, update `onuIndex` (and log it), so what staff see matches the OLT.
3. **Automatic backups** (mysqldump + Task Scheduler, per the deployment doc).
4. **Express serves the React build on :8787** (today they run as two servers).
5. **One full dry run** on dev data: bill → pay → record → check → sweep → reconnect.
6. **Per installation:** set `MANAGE_API_KEY`, add the branch in SuperAdmin, create the Owner login,
   fill in Settings → How customers pay (incl. Terms), upload the logo.
7. `npm run gcash:inspect` on a multi-page statement when one is available.

## ⏸️ Parked (code kept, don't build on it)

- **HitPay** online checkout, and **GCash for Business** merchant QR — [D8](decisions.md#d8--gcash-business-merchant-qr-on-the-invoice-option-a-hitpay-parked)
- **Multi-branch business features** (cross-branch reports, shared data). Each branch is standalone; only SuperAdmin spans them ([D7](decisions.md#d7--one-branch-per-installation), [D10](decisions.md#d10--one-central-superadmin-over-tailscale)).
- Outage credits, alert emails, data export/anonymise — not started, not needed yet.

## Where things are

| | |
| --- | --- |
| Decisions (why things are the way they are) | [decisions.md](decisions.md) |
| How it is deployed (branches, SuperAdmin, Tailscale) | [isp-invoice-generator-deployment-multibranch.md](isp-invoice-generator-deployment-multibranch.md) |
| Payments, day to day | [payments.md](payments.md) |
| What to do when something breaks | [runbooks.md](runbooks.md) |
| The old migration plan and 1,800-line checklist | [archive/](archive/) (history only) |
