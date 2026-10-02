# Deployment, step by step (and the two-PC rehearsal)

**Created:** 2026-09-28 · Windows 10/11, PowerShell. Architecture and the reasons behind it:
[isp-invoice-generator-deployment-multibranch.md](isp-invoice-generator-deployment-multibranch.md),
[D10](decisions.md#d10--one-central-superadmin-over-tailscale),
[D11](decisions.md#d11--a-billing-only-branch-the-network-switch).

This is the order to set up a real deployment: **one SuperAdmin PC** (yours) and **one branch PC**
(the client's). The first run is a rehearsal on two of your own computers:

| | Plays the part of | Runs |
| --- | --- | --- |
| **PC 1** (this computer) | The developer's SuperAdmin PC | `superadmin-server` + the SuperAdmin web app, Tailscale |
| **PC 2** (second computer) | The client's branch PC | MySQL, the branch server (`back`, serving the built `front`), the worker, Tailscale |

Do the rehearsal exactly as you would at the client's: a clean PC 2, nothing copied from your dev
setup except the code. Anything that goes wrong now is one less thing that goes wrong on site.

> **Record every secret as you create it** in `docs/credentials.txt` on PC 1 (git-ignored). Lose
> `CREDENTIAL_MASTER_KEY` or `SUPERADMIN_SECRET` and saved passwords/keys have to be entered again.

---

## Part 1 · Both PCs: install the basics

1. **Node.js 22 LTS**, version **22.13 or newer** (SuperAdmin needs 22.13 for its built-in SQLite).
   `node -v` to check.
2. **Git** (only needed to fetch the code).
3. **Tailscale**. Sign in to **the same Tailscale account** on both PCs, so both are in one tailnet.
   Then on each PC:
   ```powershell
   tailscale ip -4        # note it: e.g. PC 1 = 100.x.y.1, PC 2 = 100.x.y.2
   ```
   In the Tailscale admin console, turn **key expiry off** for PC 2. A branch PC must not drop off
   the network because nobody logged in for 180 days.

## Part 2 · PC 2 (branch): MySQL

1. Install **MySQL 8.0 Community Server** (MySQL Installer → Server only). Choose:
   - **Windows Service**, started at system startup.
   - Port **3306**. Don't open it in the firewall.
   - A strong **root** password. Record it.
2. Create the database and the application's own login (the app never uses `root`). Open
   **MySQL 8.0 Command Line Client**, log in as root, then:
   ```sql
   CREATE DATABASE teranetwork CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'teranetwork_app'@'localhost' IDENTIFIED BY '<strong password>';
   GRANT ALL PRIVILEGES ON teranetwork.* TO 'teranetwork_app'@'localhost';
   FLUSH PRIVILEGES;
   ```
   Record the password.

## Part 3 · PC 2 (branch): the code

1. Fetch it into a short path with no spaces:
   ```powershell
   git clone https://github.com/rave112002/TERANETWORK-SYSTEM.git C:\TERANETWORK
   cd C:\TERANETWORK
   git log --oneline -1       # note the commit you are deploying
   ```
   (Private repo: sign in to GitHub when asked. On a client PC, prefer copying the folder over
   leaving your GitHub login on it — without `node_modules`, `.env` or `docs/credentials.txt`.)
2. Install dependencies:
   ```powershell
   cd C:\TERANETWORK\back;  npm ci
   cd C:\TERANETWORK\front; npm ci
   ```

## Part 4 · PC 2 (branch): configure the server

1. `cd C:\TERANETWORK\back` and `copy .env.example .env`. Edit `.env`. Generate each secret with:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Each key must appear **once** in the file (a second line silently wins).

   | Setting | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `PORT` | `8787` |
   | `APP_NAME` | `TERANETWORK` |
   | `APP_URL` | `http://localhost:8787` (password-reset links point here) |
   | `DB_HOST` / `DB_PORT` | `localhost` / `3306` |
   | `DB_USER` / `DB_PASS` / `DB_DATABASE` | `teranetwork_app` / its password / `teranetwork` |
   | `COMPANY_NAME` / `COMPANY_EMAIL` / `BRANCH_NAME` | `TERANETWORK` / the company email / e.g. `Test Branch` (the real branch name on site) |
   | `ISSUER` / `AUDIENCE` | `teranetwork` / `teranetwork-staff` |
   | `CSRF_SECRET`, `LOG_SALT` | two different generated secrets (replace the `CHANGE_THIS…` values) |
   | `CREDENTIAL_MASTER_KEY` | a generated secret. **Record it.** It encrypts saved OLT passwords |
   | `MANAGE_API_KEY` | a generated secret. **Record it.** SuperAdmin needs the same value in Part 7 |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.gmail.com` / `587` / `false` |
   | `SMTP_USER` / `SMTP_PASS` | the branch's own Gmail / a Gmail **App Password** (Google account → Security → 2-Step Verification on → App passwords) |
   | `MAIL_FROM` | `TERANETWORK <that gmail address>` |
   | `EMAIL_DAILY_LIMIT` | `500` |
   | `COOKIE_SECURE` | `false` (staff use plain http: localhost or the Tailscale IP) |
   | `PAYMENT_PROVIDER` / `PAYMENT_MOCK_SECRET` | leave as in the example, secret **blank** (online payment is parked, D9) |

   For the rehearsal, a Gmail you own is fine. **Customers in the test must have email addresses
   you own too** — the system really sends.
2. JWT signing keys and the database:
   ```powershell
   npm run keys          # writes auth-keys\private.pem and public.pem
   npm run db:setup      # tables, permissions, the company, this one branch, its roles
   npm run db:check      # every table listed, no errors
   ```
   `db:setup` creates **no login**. The first Owner is made from SuperAdmin in Part 7.
   **Never** run `db:seed:dev` or `db:setup:clean` here.
3. Build the app the server will serve. In `C:\TERANETWORK\front`, create `.env.production` with:
   ```ini
   VITE_APP_NAME=TERANETWORK
   VITE_APP_ENV=production
   VITE_SENTRY_DSN=
   ```
   Then `npm run build`. It must end with `check-build: dist/ OK (branch app, no SuperAdmin console)`.

## Part 5 · PC 2 (branch): run it

1. **First, by hand** in two terminals, to see any error:
   ```powershell
   cd C:\TERANETWORK\back; npm start          # terminal 1: the app + API on :8787
   cd C:\TERANETWORK\back; npm run worker     # terminal 2: emails, scheduled billing, device jobs
   ```
   Terminal 1 should say it is serving the frontend build. Open **http://localhost:8787/** on
   PC 2: the login page. (There is no login yet; that comes in Part 7.)
2. **Firewall.** Allow port 8787 from the tailnet only (admin PowerShell):
   ```powershell
   New-NetFirewallRule -DisplayName "TERANETWORK 8787 (Tailscale only)" -Direction Inbound -Protocol TCP -LocalPort 8787 -RemoteAddress 100.64.0.0/10 -Action Allow
   ```
   If Windows pops up "allow Node.js on networks", choose **Private only** / cancel. The rule above
   is the access you want. Do not forward any router port.
3. **Run as Windows services**, so staff never start Node by hand. Install NSSM **2.24-101**
   (not 2.24) and copy `nssm.exe` into `C:\Windows\System32`. The services run through it, so it
   must not stay inside a user's profile. In admin PowerShell:
   ```powershell
   winget install -e --id NSSM.NSSM
   Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter nssm.exe |
     Where-Object FullName -like "*win64*" | Select-Object -First 1 |
     Copy-Item -Destination C:\Windows\System32\
   nssm version                # NSSM 2.24-101-…
   ```
   (If `nssm.exe` isn't found there, `where.exe nssm` shows where winget put it.)
   Stop the two terminals, then in admin PowerShell. **Create the logs folder first:** the
   `AppStdout` lines point into it.
   ```powershell
   mkdir C:\TERANETWORK\logs
   $node = (Get-Command node).Source
   nssm install TeranetworkApp    $node "server\bin\www.js"
   nssm set     TeranetworkApp    AppDirectory C:\TERANETWORK\back
   nssm set     TeranetworkApp    DependOnService MySQL80
   nssm set     TeranetworkApp    AppStdout C:\TERANETWORK\logs\app.log
   nssm set     TeranetworkApp    AppStderr C:\TERANETWORK\logs\app.log
   nssm install TeranetworkWorker $node "server\bin\worker.js"
   nssm set     TeranetworkWorker AppDirectory C:\TERANETWORK\back
   nssm set     TeranetworkWorker DependOnService MySQL80
   nssm set     TeranetworkWorker AppStdout C:\TERANETWORK\logs\worker.log
   nssm set     TeranetworkWorker AppStderr C:\TERANETWORK\logs\worker.log
   nssm start TeranetworkApp; nssm start TeranetworkWorker
   ```
   (`MySQL80` is the default service name; check yours in `services.msc`.) Both services start
   automatically with Windows (proven in the 2026-10-02 rehearsal).

   > **`DependOnService MySQL80` cuts both ways.** Stopping MySQL by hand (`net stop MySQL80`, or
   > from `services.msc`) also stops **both** app services, and starting MySQL again does **not**
   > bring them back. SuperAdmin then shows the branch **Offline**. After any manual MySQL stop:
   > `net start MySQL80; nssm start TeranetworkApp; nssm start TeranetworkWorker`.

4. **The PC must be on the network before anyone logs in to Windows.** Otherwise Tailscale and
   SuperAdmin can't reach it after a restart. Use Ethernet. If it has to be Wi-Fi, set that network's
   profile to **Connect automatically**.

## Part 6 · PC 1 (SuperAdmin): set up

```powershell
cd <repo on PC 1>\superadmin-server
npm install
copy .env.example .env      # SUPERADMIN_SECRET = a generated secret (record it); HOST stays 127.0.0.1
npm run user -- --username <you> --first <First> --last <Last>     # your SuperAdmin login
cd ..\front
npm ci                      # the build needs front's own dependencies
npm run build:superadmin    # must end: check-build: dist-superadmin/ OK (SuperAdmin app)
cd ..\superadmin-server
npm start                   # http://127.0.0.1:8788
```

Open **http://127.0.0.1:8788/** and sign in.

## Part 7 · Connect PC 1 to PC 2, then set up the branch

**From SuperAdmin (PC 1):**

1. **Branches → Add branch:** name (e.g. `Test Branch`), address `http://<PC 2 Tailscale IP>:8787`,
   and PC 2's `MANAGE_API_KEY`. It should show **Online**. If not, see the status table in
   [superadmin-server/README.md](../superadmin-server/README.md).
2. **System Settings** (pick the branch):
   - **Network features:** **off** for a billing-only branch (D11). Leave on only if this branch
     will manage its OLT.
   - If on: **Dry-run ON** before any OLT is added.
   - Billing schedule: the client's (invoices on the 25th, due the 2nd).
3. **Users → Add login → Owner:** real email, **Generate** a password, copy it before saving.
4. **Company Profile:** name, TIN, address, phone, logo (PNG/JPG). This logo is on every invoice.

**On the branch app** (PC 2 at http://localhost:8787/, or from PC 1 at
`http://<PC 2 Tailscale IP>:8787/`), signed in as the Owner:

5. **Settings → How customers pay:** GCash number, account name, Facebook page, Terms and
   conditions. Check the preview.
6. **Subscribers → Service Plans:** the client's plans.
7. **User Management → Users:** staff logins (Billing, Technician) with their roles.

## Part 8 · The full test (rehearsal)

Tick each one. Write down anything odd, with the time, for the log check afterwards.

**Connection and access**
- [ ] SuperAdmin → Branches: **Online**, correct version, no warning except "No backup reported".
- [ ] PC 2 opens `http://localhost:8787/` → login page (not the old `/admin` path).
- [ ] PC 1 opens `http://<PC 2 Tailscale IP>:8787/` → the same app (remote staff access).
- [ ] With Tailscale **off** on PC 1, that address does **not** open (nothing outside the tailnet).
- [ ] Owner logs in; each staff role sees only its own menus.

**Billing, end to end** (2–3 test customers with your own email addresses)
- [ ] Customers created (phone typed as `0912 3456 789`).
- [ ] Subscriptions created and **activated** (billing-only: no modem needed).
- [ ] Billing → Adjustments: one on a single subscription, one **bulk** on two; the confirmation shows count and total.
- [ ] Billing → Invoices → **Run billing** for this month: one invoice per active subscription, adjustments applied as their own lines.
- [ ] **View PDF**: the client's layout, company logo, How-to-pay and Terms printed.
- [ ] The invoice **email arrives** with the PDF attached. Admin → System shows the sent count.
- [ ] Record a payment with a GCash reference; the invoice turns paid; receipt email arrives.
- [ ] Billing → GCash Check: upload a real GCash statement PDF; matched / typo / not-recorded lists make sense.
- [ ] Reports: aging, collections, subscribers load and export CSV.
- [ ] Audit Trail shows each action above, including SuperAdmin's as `system:superadmin:<you>`.

**Surviving the everyday**
- [ ] **Restart PC 2.** Without logging in to Windows, from PC 1: the app opens and SuperAdmin shows Online again (services + Tailscale came back by themselves).
- [ ] **Turn off PC 1.** PC 2 keeps working normally (branches don't depend on SuperAdmin).
- [ ] **Crash MySQL** on PC 2 (admin PowerShell: `taskkill /F /IM mysqld.exe`): SuperAdmin shows "Online, but its database is down", then Online again once Windows restarts MySQL by itself. Don't test with `net stop MySQL80`. It also stops both app services (see Part 5.3), and SuperAdmin shows Offline.
- [ ] **Password reset** from SuperAdmin → Users works; the old session is signed out.

**Backup and restore** (automatic backups aren't built yet; do this one by hand)
- [ ] On PC 2:
  ```powershell
  mkdir C:\TERANETWORK\backups
  & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u root -p --routines --single-transaction --result-file=C:\TERANETWORK\backups\teranetwork-test.sql teranetwork
  ```
  Use `--result-file=`, not `> file.sql`. Windows PowerShell's `>` can write the dump as UTF-16,
  and `mysql` can't read that back.
- [ ] Restore it into a scratch database and check the customer and invoice counts match:
  ```powershell
  & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "CREATE DATABASE restore_test"
  & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p restore_test -e "source C:/TERANETWORK/backups/teranetwork-test.sql"
  ```
  Use forward slashes in the `source` path. Then `DROP DATABASE restore_test;`.

**Afterwards**
- [ ] Read `C:\TERANETWORK\logs\app.log` and `worker.log` for errors you didn't see on screen.
- [ ] Update [STATUS.md](STATUS.md) with what passed and what didn't. The 2026-10-02 rehearsal's
  results are in [rehearsal-status.md](rehearsal-status.md).

## Part 9 · After the rehearsal, before the real client PC

- The rehearsal data is fake. On the client's PC start from Part 2 with a **fresh** database; don't
  carry the test one over.
- Install to `C:\TERANETWORK` (Part 3), never under a user's Documents.
- Use the **client's** Gmail (App Password) and the real `BRANCH_NAME`. In the rehearsal, receipt
  emails (Gmail → Gmail) went to spam. Ask customers to save the address. A domain email with
  SPF/DKIM can come later.
- Import the client's customers (the import screen is still to be built — see STATUS).
- Set up **automatic backups** (still to be built — see STATUS) and test a restore on site.
- Turn on **BitLocker** on the branch PC if available, and keep Windows, MySQL, Node and Tailscale
  updated.

## Updating a branch later

```powershell
nssm stop TeranetworkWorker; nssm stop TeranetworkApp
cd C:\TERANETWORK; git pull            # or copy the new code over
cd back;  npm ci; npm run db:migrate   # applies new migrations only
cd ..\front; npm ci; npm run build
nssm start TeranetworkApp; nssm start TeranetworkWorker
```

Back up the database first. If the management API version changed, update SuperAdmin on PC 1 in
the same sitting (SuperAdmin → Branches shows **Needs update** otherwise).
