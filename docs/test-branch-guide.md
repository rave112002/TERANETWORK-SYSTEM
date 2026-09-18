# Fresh test branch: setup, real OLT, customers

**Created:** 2026-09-18 · For the developer's PC. Windows PowerShell commands.

This takes your dev database from "two seeded branches full of fake data" to **one clean test
branch**, managed from the central SuperAdmin, ready to test against the **real HSGQ OLT** and to
receive the client's customers.

> ⚠️ **Read these first**
>
> 1. **Customer import is not built yet.** Part 7 covers what to do until it is.
> 2. **Dry-run defaults to OFF on a fresh database.** Turn it **ON** (part 4) **before** adding the
>    real OLT, or the first automatic job can send real commands to the device.
> 3. **The system has never driven the real OLT itself.** The driver's commands come from your
>    bench validation (blacklist + deregister, save), but automation over telnet is untested. Part 6
>    tests it safely, one step at a time, on your bench described in
>    [HSGQ_DOCUMENTATION.md](vendor-transcripts/hsgq-xe04i/HSGQ_DOCUMENTATION.md).

---

## 1. Back up the current dev database (2 minutes)

`db:setup:clean` **drops every table**. Keep a copy so you can go back.

```powershell
cd "C:\Users\techn\Documents\PROJECTS\TERA\TERANETWORK-SYSTEM!\back"
# Adjust the MySQL path/version if yours differs. Use the DB_* values from back\.env.
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u <DB_USER> -p --routines <DB_DATABASE> > "$env:USERPROFILE\Desktop\teranetwork-dev-before-fresh.sql"
```

Enter the database password when asked. Check the file on your Desktop is not empty.

To restore it later, see [part 9](#9-going-back-to-the-old-dev-data).

## 2. Stop everything

Stop the API, the worker and both dev servers: **Ctrl+C** in each terminal. Close any PuTTY or
telnet session to the OLT.

## 3. Wipe and set up one clean branch

Edit `back\.env`:

```ini
COMPANY_NAME=TERANETWORK
COMPANY_EMAIL=ops@teranetwork.ph      # required
BRANCH_NAME=Test Branch               # required — the name of this installation's one branch
MANAGE_API_KEY=<keep what is there>   # SuperAdmin already knows this key
CREDENTIAL_MASTER_KEY=<keep what is there>
```

Then:

```powershell
cd "C:\Users\techn\Documents\PROJECTS\TERA\TERANETWORK-SYSTEM!\back"
npm run db:setup:clean
```

You get: all migrations, the permission list, **one company, one branch ("Test Branch")** and its
Owner / Admin / Billing / Technician roles. **No logins and no customers.**

**Do not** run `npm run db:seed:dev` — that adds fake customers and invoices, which is what you
are getting rid of.

> Your old Admin login (`new.lower.bicutan@teranetwork.ph`) no longer exists after this.
> `docs/credentials.txt` is out of date. You'll create a new Owner in part 4.

## 4. Start everything and connect SuperAdmin

Four terminals:

| Terminal | Folder | Command | Opens |
| --- | --- | --- | --- |
| 1. Branch API | `back` | `npm run dev` | http://localhost:4000 |
| 2. Worker (device jobs, schedules, emails) | `back` | `npm run worker:dev` | — |
| 3. Admin portal | `front` | `npm run dev` | http://localhost:5173/admin |
| 4. SuperAdmin | `superadmin-server` | `npm start` | http://127.0.0.1:8788 |

In **SuperAdmin** (http://127.0.0.1:8788):

1. **Branches:** your old entry points at `http://127.0.0.1:4000` with the same key, so it
   now shows the new installation. Use ⋮ → **Edit connection** to rename it **Test Branch**.
   Remove any other entries (⋮ → Remove from SuperAdmin; this only removes them from the list).
2. The row should show **Online**. Under "Needs attention" the **"2 branches"** warning is
   gone; "No backup reported" is expected.
3. **System Settings** → turn **Dry-run ON**. Do this now, before any OLT exists.
4. **Users** → **Add login** → **Owner**. Use your real email, and a generated password.
5. **Company Profile** → name, TIN, address, logo (PNG/JPG).

## 5. Set up the branch in the Admin portal

Log in at http://localhost:5173/admin with the Owner login from part 4.

1. **Settings → How customers pay:** GCash number, account name, Facebook page, Terms.
2. **Subscribers → Plans:** the client's plans (₱699 / ₱850 / ₱950 / ₱1,399 per the interim spec;
   confirm names and speeds with the client).
3. **User Management → Users:** staff logins (Billing, Technician) if you want to test those roles.

## 6. Real hardware: the HSGQ OLT

Your bench ([HSGQ_DOCUMENTATION.md](vendor-transcripts/hsgq-xe04i/HSGQ_DOCUMENTATION.md)):

```
PC 192.168.100.219 ──route──▶ MikroTik 192.168.100.132 ──vlan88──▶ HSGQ XE04I 192.168.88.10:23 (telnet, root)
                                                                     └─ PON 1 → 1:16 NAP → Huawei EG8145V5
                                                                        ONU 1/27 · MAC 30:c5:0f:d8:7f:2c
```

### Before you start

- **The route to the OLT still works.** The API and the worker run on this PC and telnet to the
  OLT themselves:
  ```powershell
  route print 192.168.88.*                           # the persistent route via 192.168.100.132
  Test-NetConnection 192.168.88.10 -Port 23          # → TcpTestSucceeded : True
  ```
  If the route is missing: `route -p add 192.168.88.0 mask 255.255.255.0 192.168.100.132`
  (admin PowerShell).
- **Close PuTTY and the Winbox terminal.** The XE04I allows **one** CLI session. An open PuTTY
  window blocks the system, and it looks like a connection error.
- **Dry-run is ON** (part 4, step 3). Check the banner on SuperAdmin → System Settings.
- **The test ONU is 1/27** (the Huawei, MAC `30:c5:0f:d8:7f:2c`). It is the only ONU online. Its
  description on the OLT ("Jacqueline-Rebancos PON 2 NAP 1 PORT 5") is left over from the
  previous ISP; ignore it.

### Step A: add the OLT and its port

Admin portal → **Network → OLTs → Add OLT**:

| Field | Value |
| --- | --- |
| Name | e.g. `HSGQ XE04I (bench)` |
| Vendor / Technology | `hsgq` / `epon` |
| Model | `XE04I` |
| Protocol | `telnet` (the driver supports telnet only) |
| Host / Port | `192.168.88.10` / `23` |
| Max concurrent sessions | `1` |
| Credentials | username `root`, its password, enable password only if `enable` asks for one |

Credentials are encrypted with `CREDENTIAL_MASTER_KEY` and cannot be read back. A wrong password
looks like a connection failure, so re-enter it if in doubt.

Then, in order: **Network → PON Ports:** port `1` on this OLT. **Splitters:** one on port 1 (your
1:16). **NAPs:** one on that splitter, for the test ONU. Ports 2–4 are down on the bench; add them
later if you need them.

### Step B: read-only discovery (safe even with dry-run off)

**Network → Discovery → Sweep an OLT.** This only **reads** (`show onu-info all`). It creates
nothing.

- ✅ **It works:** about **200 ONUs** appear marked **Not on file**: bindings left over from the
  previous ISP (60 on PON 1, 36 / 56 / 48 on 2–4), **only 1/27 online**. Check 1/27's MAC reads
  `30:c5:0f:d8:7f:2c`.
- ❌ **Errors, or the list is empty or garbled:** the parser needs adjusting. Send me the error
  and the raw output (Discovery → the run → item details).

Add **only 1/27**: its row's ⋮ → **Add to inventory**, on PON 1 and your NAP. **Leave the other
~199 alone.** They are not TERANETWORK customers.

Then **Network → ONUs →** 1/27 ⋮ → **Check status now** (`show onu-info all` + `show optical-info`,
read-only). Expect it **online**, with RX power around −12 dBm (the bench measured −11.97).

> The OLT's clock is stuck in the year 2000, so dates in the raw replies are wrong. The system
> records its own time for everything, so it doesn't matter. Fix the clock with NTP whenever you
> like (§ "Recommended Immediate Actions" in the bench doc).

### Step C: rehearse with dry-run ON

1. Add a **test customer** by hand ("TEST – Bench ONU") and a **subscription** on ONU 1/27.
2. **Network → ONUs →** 1/27 ⋮ → **Suspend service**, then **Restore service**. (Staff can't
   suspend a *subscription* directly; only the unpaid-account sweep does that (D6). The ONU's own
   actions are the manual test.)
3. Same menu → **Device history.** Both entries are marked `dry_run`, and the commands should be
   exactly what you validated on the bench:

   | Action | Commands (inside `interface epon 1`) |
   | --- | --- |
   | Suspend | `blacklist add mac 30:c5:0f:d8:7f:2c` → `onu-deregister 27` → `save` |
   | Restore | `blacklist delete mac 30:c5:0f:d8:7f:2c` → `save` |

If anything differs, stop here and send me the Device history entry.

### Step D: one real disconnect and reconnect (ONU 1/27 only)

1. SuperAdmin → System Settings → **Dry-run OFF** (it asks to confirm).
2. 1/27 ⋮ → **Suspend service.** The worker runs it within seconds.
3. Check it really dropped: the Huawei's PON light goes off/red, and 1/27 shows offline in a
   fresh **Check status now**. Device history shows the OLT's real replies.
4. 1/27 ⋮ → **Restore service.** It should re-register on its own within a minute (removing it
   from the blacklist is enough; you confirmed this on the bench).
5. **Dry-run back ON.**

Send me the Device history entries (commands and replies) from this step, working or not. They
are the first transcripts of the system driving the OLT itself, and the driver is tuned from them.

> **Leave dry-run ON** except while you are watching a test. The worker runs the daily
> disconnection sweep (20:00) and the billing run on its own. With real customers imported and
> dry-run off, those act on real people.

### Not covered: MikroTik

The bench doc gives the router (RB4011iGS+RM, `192.168.100.132` / `192.168.88.1`, PPPoE on VLANs
10–40), but **the system has no MikroTik integration yet**. It is still waiting on the client:
RouterOS version, an API user, and what the old Sheets → MikroTik step changed. Disconnection
today is done at the OLT only.

## 7. Customers from the client's spreadsheet

**The import screen does not exist yet.** It is the next thing to build: upload the client's
`.xlsx`, see every row checked (missing phone, duplicate account, unknown plan…), fix or skip
the bad ones, then import. The client's file (`NEW-INVOICE-SYSTEM\TEMPLATE.xlsx`, about 217
subscribers) stays on your PC. It is real personal data and never goes into the repo.

Until then:

- Add **2–3 customers by hand** (Subscribers → Customers) to test billing and payments end to end.
- **Don't** type in all 217. The import will do it with checks, and hand-typed records can
  collide with it.

## 8. Quick checklist

- [ ] Dev database backed up (part 1)
- [ ] `db:setup:clean` with `BRANCH_NAME=Test Branch` (part 3)
- [ ] API, worker, Admin portal, SuperAdmin running (part 4)
- [ ] SuperAdmin shows Test Branch **Online**, no "2 branches" warning
- [ ] **Dry-run ON**
- [ ] Owner login created, company profile filled
- [ ] How customers pay and Plans set up (part 5)
- [ ] `Test-NetConnection 192.168.88.10 -Port 23` succeeds, PuTTY closed
- [ ] OLT, PON 1, splitter, NAP added; discovery lists ~200 ONUs with 1/27 online
- [ ] Only ONU 1/27 added to inventory; Check status now shows it online
- [ ] Dry-run commands match the bench (blacklist + deregister + save / blacklist delete + save)
- [ ] One real suspend and restore on 1/27, transcripts sent
- [ ] **Dry-run back ON**

## 9. Going back to the old dev data

```powershell
cd "C:\Users\techn\Documents\PROJECTS\TERA\TERANETWORK-SYSTEM!\back"
npm run db:reset          # ⚠️ drops the whole database and recreates it empty
Get-Content "$env:USERPROFILE\Desktop\teranetwork-dev-before-fresh.sql" | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u <DB_USER> -p <DB_DATABASE>
npm run db:migrate        # re-applies any migration newer than the backup
```

Put the old `BRANCH_NAME` back in `back\.env`.
