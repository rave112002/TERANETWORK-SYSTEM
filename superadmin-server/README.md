# SuperAdmin server

The central SuperAdmin app's server. It runs on **the developer's PC only**, never on a branch PC,
and manages every branch over Tailscale through each branch's `/api/v1/manage/*`
([D10](../docs/decisions.md#d10--one-central-superadmin-over-tailscale)).

```
browser ──▶ superadmin-server (this) ──Tailscale──▶ branch back/  /api/v1/manage/*  (key per branch)
               │
               └── data/superadmin.db   SuperAdmin logins, sessions, branch list (keys encrypted)
```

- **No branch business data** is stored or shown here: health and management only.
- **The browser never sees a branch key.** Keys go in once and stay encrypted.
- **Dependencies:** Express only. SQLite, password hashing and encryption come with Node 22.13+.
- **Contract:** `../shared/manage-contract/` holds the API version and shapes, shared with `back/`.

## Set up (SuperAdmin PC)

```powershell
cd superadmin-server
npm install
copy .env.example .env          # then fill in SUPERADMIN_SECRET
npm run user -- --username raven --first Raven --last Bayatan
npm start                       # http://127.0.0.1:8788
```

Build the web app once so the server can serve it:

```powershell
cd ..\front
npm run build:superadmin         # → front/dist-superadmin
```

## Add a branch

1. On the **branch PC**, put a key in `back/.env`: `MANAGE_API_KEY=<32+ random characters>` and
   restart the branch server.
2. In **SuperAdmin → Branches → Add branch**: the branch name, its address on Tailscale
   (e.g. `http://100.64.0.12:8787`) and the same key.

The branch shows **Online** when the address and key are right.

| Status | Meaning | Fix |
| --- | --- | --- |
| Online | Reachable, key right, compatible | — |
| Degraded | Reachable, but its database is down | Check MySQL on the branch PC |
| Offline | No answer | Branch PC off, Tailscale down, or wrong address |
| Wrong key | Key doesn't match | Re-enter the key, or check the branch's `.env` |
| Not enabled | Branch has no `MANAGE_API_KEY` | Set it in the branch's `.env`, restart |
| Needs update | Branch or SuperAdmin on an incompatible version | Update the older one |

## What it can do per branch

| Page | Branch endpoint | Notes |
| --- | --- | --- |
| Branches | `GET /manage/health` | Status, version, warnings; checked every 30 s |
| Company Profile | `GET/PUT /manage/company-profile`, `GET/PUT/DELETE /manage/company-profile/logo` | Logo: PNG or JPG, 2 MB, passed through untouched. Each change is audited on the branch as `system:superadmin:<username>`. |
| Users | `GET/POST /manage/users`, `PUT /manage/users/:id/password`, `PUT /manage/users/:id/status` | Owner and Admin logins only (staff logins stay on the branch). One Owner per branch; the only active Owner can't be deactivated. Passwords go straight to the branch and are never stored here or written to the audit trail. |

## Development

```powershell
npm run dev        # API on :8788, restarts on change
npm test           # node:test, no database or network needed
```

Front end in dev: `cd ../front && npm run dev:superadmin` (Vite proxies `/api` here).

## Back up

Copy `data/superadmin.db` and keep `SUPERADMIN_SECRET` with it: the database without the
secret cannot decrypt the branch keys.
