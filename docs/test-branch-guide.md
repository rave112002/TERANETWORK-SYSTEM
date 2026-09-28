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

Edit `back\.env`, setting these three (change the existing lines if they are there):

```ini
COMPANY_NAME=TERANETWORK
COMPANY_EMAIL=ops@teranetwork.ph      # required
BRANCH_NAME=Test Branch               # required — the name of this installation's one branch
```

**Do not touch `MANAGE_API_KEY` or `CREDENTIAL_MASTER_KEY`, and don't add second copies of them.**
The later line wins, so a second line replaces the real key. SuperAdmin already knows the manage
key, and the credential key decrypts saved OLT passwords. Each should appear exactly once in the
file.

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

Your bench (updated 2026-09-24; see
[HSGQ-XE04I-CLI-Validation-v2.md](vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation-v2.md) §1).
The PC is now on the MikroTik's LAN by cable, with no USB LAN adapter:

```
Converge router ──LAN──▶ MikroTik ether1-ISP1
PC 192.168.50.253 (DHCP) ──LAN──▶ MikroTik ether4-LAN 192.168.50.1 ──vlan88 on ether3──▶ HSGQ XE04I 192.168.88.10:23 (telnet)
                                                                                           └─ PON 1 → Huawei EG8145V5
                                                                                              ONU 1/27 · MAC 30:c5:0f:d8:7f:2c
```

### Before you start

- **The OLT is reachable.** The MikroTik is the PC's default gateway and routes to VLAN 88 itself,
  so no static route is needed. The API and the worker run on this PC and telnet to the OLT
  themselves:
  ```powershell
  Test-NetConnection 192.168.88.10 -Port 23          # → TcpTestSucceeded : True
  ```
  `PingSucceeded : False` is normal; ICMP is blocked. A persistent route to `192.168.88.0` via
  `192.168.50.1` is harmless; delete any old one via `192.168.100.132`
  (`route delete 192.168.88.0`, admin PowerShell).
- **Close PuTTY and the Winbox terminal.** The XE04I allows **one** CLI session. An open PuTTY
  window blocks the system, and it looks like a connection error.
- **Dry-run is ON** (part 4, step 3). Check the banner on SuperAdmin → System Settings.
- **The test ONU is 1/27** (the Huawei, MAC `30:c5:0f:d8:7f:2c`). It is the only ONU online.
- ⚠️ **Never reboot the OLT from the GUI or the CLI.** On this firmware it hangs until someone
  pulls the power (v2 §16). The system never sends `reboot`.
- ⚠️ **Never plug the OLT's MGMT port into the Converge router.** It is set to `192.168.100.1`,
  the Converge router's own address.
- The OLT, the ONU and the MikroTik share one power source. Cutting it restarts all three.

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

**Network → Discovery → Sweep an OLT.** This only **reads** (`show onu-info all`, one session
per PON port you registered). It creates nothing.

- ✅ **It works:** with only PON 1 registered, **60 ONUs** appear marked **Not on file**. They
  are bindings left over from the previous ISP. **Only 1/27 is online.** Check 1/27's MAC reads
  `30:c5:0f:d8:7f:2c`. (Registering ports 2–4 as well gives about 200: 36 / 56 / 48.)
- ❌ **Errors:** the sweep now fails loudly rather than returning a short list. It fails if the
  OLT answers `vty% …`, if the list never reaches its `Total:` footer, or if the number of rows
  read differs from `Total:`. Send me the error message and the raw output (Discovery → the run →
  item details).
- ❌ **"Timed out waiting for prompt/more":** send me the `got: "…"` text at the end of the
  message. It shows the last thing the OLT printed.
- ❌ **"The OLT refused the login":** re-enter the credentials on the OLT (Step A).

Add **only 1/27**: its row's ⋮ → **Add to inventory**, on PON 1 and your NAP. **Leave the other
~199 alone.** They are not TERANETWORK customers.

Then **Network → ONUs →** 1/27 ⋮ → **Check status now** (`show onu-info all` + `show optical-info`,
read-only). Expect it **online**, with RX power around −12 dBm (the bench measured −11.97).

> The OLT's clock is stuck in the year 2000, so dates in the raw replies are wrong. The system
> records its own time for everything, so it doesn't matter. Fix the clock with NTP whenever you
> like (§ "Recommended Immediate Actions" in the bench doc).

### Step C: rehearse with dry-run ON

0. 1/27 must show **Active** first: the ⋮ menu offers *Suspend service* only on an active ONU.
   An ONU imported from Discovery while online starts active. One added by hand with **Add ONU**
   starts **Unprovisioned**, and a dry-run *Check status now* does not change that. In that case,
   turn dry-run OFF for one **Check status now** (it only sends `show` commands), then turn it back
   ON.
1. Add a **test customer** by hand ("TEST – Bench ONU") and a **subscription** on ONU 1/27.
2. **Network → ONUs →** 1/27 ⋮ → **Suspend service**. (Staff can't suspend a *subscription*
   directly; only the unpaid-account sweep does that (D6). The ONU's own actions are the manual
   test.) A dry-run changes nothing, so 1/27 stays **Active**, and **Restore service**, which
   appears only on a suspended ONU, can't be rehearsed here. You'll see its commands for real in
   step D, and the driver's tests check them.
3. Same menu → **Device history.** The entry is marked `dry_run`, and the commands should be
   exactly these:

   | Action | Commands |
   | --- | --- |
   | Suspend | `interface epon 1` → `blacklist add mac 30:c5:0f:d8:7f:2c` → `show blacklist onu-info all` → `end` → `copy running-config startup-config` |
   | Restore | `interface epon 1` → `blacklist delete mac 30:c5:0f:d8:7f:2c` → `show blacklist onu-info all` → `end` → `copy running-config startup-config` |

   **No `onu-deregister`** (changed 2026-09-24). The v2 re-test showed that `blacklist add` alone
   unbinds and drops the ONU. A deregister after it only answers "ONU is not exist", which the
   system would count as a failure and retry. Each action reads the blacklist back: that table is
   the proof, not the command's reply. `blacklist delete` sometimes prints an error even when it
   worked. Before every session the system also sends `enable`, `terminal length 0` and
   `configure`; those aren't listed here.

If anything differs, stop here and send me the Device history entry.

### Step D: one real disconnect and reconnect (ONU 1/27 only)

1. SuperAdmin → System Settings → **Dry-run OFF** (it asks to confirm).
2. 1/27 ⋮ → **Suspend service.** The worker runs it within seconds.
3. Check it really dropped: the Huawei's PON light goes off/red. Device history shows the
   OLT's real replies, and the blacklist table in them lists the MAC. A fresh **Check status now**
   shows 1/27 **not online**. It is missing from the OLT's ONU table altogether, because
   blacklisting deletes its binding.
4. 1/27 ⋮ → **Restore service.** The OLT's reply may include `Error, No Bind ONU fail, reason:
   ONU is not exist.`, which is a known false alarm. The job succeeds if the blacklist table in
   the reply no longer lists the MAC. The ONU retries about **every 60 s**, so wait **1–2
   minutes**, then **Check status now**: online, RX about −12 dBm.
5. **Dry-run back ON.**

**If something goes wrong half-way**, put the OLT back by hand. Stop the worker first so it
doesn't retry, then in PuTTY:

```text
enable
configure
interface epon 1
show blacklist onu-info all
blacklist delete mac 30:c5:0f:d8:7f:2c
show blacklist onu-info all        ← must be empty
end
copy running-config startup-config ← " Configuration saved successfully"
```

Then close PuTTY before you start the worker again.

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
- [ ] OLT, PON 1, splitter, NAP added; discovery lists 60 ONUs on PON 1 with only 1/27 online
- [ ] Only ONU 1/27 added to inventory; Check status now shows it online
- [ ] Dry-run commands match part 6 step C (blacklist add/delete + blacklist read-back + save, no deregister)
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
