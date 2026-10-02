## Two-PC rehearsal: 2026-10-02

Superadmin PC (100.122.158.28) → client PC (100.70.207.32), Windows, Node 22, MySQL 8.0.45, NSSM 2.24-101.
Commit deployed: _<fill in>_

### Passed
- Tailscale tailnet; branch reachable only inside it (unreachable with Tailscale off).
- Branch runs as Windows services (TeranetworkApp, TeranetworkWorker) via NSSM.
- SuperAdmin: branch shows Online; Owner created; system settings; company profile.
- Branch app from localhost and over Tailscale; role menus correct for Billing and Technician.
- Billing end to end: customers, subscriptions, single and bulk adjustments, run billing, PDF, invoice email.
- Payments: recorded with GCash reference; receipt email sent (landed in spam).
- GCash Check: real reference with a different amount reported as "amount differs"; references not in the statement are not listed.
- Reports load and export CSV; Audit Trail shows all actions including SuperAdmin's.
- Client PC restart with no Windows login: app and SuperAdmin Online again (after the Wi-Fi fix).
- Superadmin PC off: branch keeps working.
- MySQL crash (taskkill mysqld): SuperAdmin "database is down", recovers by itself.
- Password reset from SuperAdmin signs out the old session.
- Manual backup and restore into a scratch DB: customer and invoice counts match.

### Fix in deployment-steps.md — ✅ applied 2026-10-03
- **Part 4.3 / Part 6:** add `npm ci` in `front` on the superadmin PC before `npm run build:superadmin`.
- **Part 5.3:** install NSSM with `winget install -e --id NSSM.NSSM`, then copy `nssm.exe` into System32 (services run through it, so it must not live in a user profile). Use 2.24-101, not 2.24.
- **Part 5.3:** create the logs folder before the `nssm set ... AppStdout` lines.
- **Part 8, MySQL test:** `net stop MySQL80` also stops both app services (DependOnService) and `net start` does not bring them back, so SuperAdmin shows Offline. Test with `taskkill /F /IM mysqld.exe` instead. Add a note: after any manual MySQL stop, run `nssm start` for both services.
- **Part 8, backup:** `mysqldump ... > file.sql` in Windows PowerShell can write UTF-16. Use `--result-file=`, and restore with `mysql ... -e "source C:/path/file.sql"` (forward slashes).

### Bugs found
- **Worker transaction helper:** when getting a DB connection fails, it still calls `rollback()` / `release()` on an undefined connection ("Cannot read properties of undefined"). Guard with `if (conn)`. Consider backoff instead of a 3 s retry while the DB is down.
  - ✅ Fixed 2026-10-03: `Database.rollback()` returns early without a connection (`back/server/config/database.js`); the worker loop backs off 3 s → 6 s → … → 30 s on consecutive queue errors and logs when the queue is reachable again (`back/server/src/lib/jobs/worker.js`).

### Notes for the real client site
- Branch PC must reach the network **before Windows login**. Prefer Ethernet; if Wi-Fi, set the profile to "Connect automatically".
- Receipt emails (Gmail → Gmail) went to spam. Use the client's Gmail, ask customers to save the address; consider a domain email with SPF/DKIM later.
- Install to `C:\TERANETWORK`, not under a user's Documents.
- Still to build before go-live: customer import, automatic backups.
