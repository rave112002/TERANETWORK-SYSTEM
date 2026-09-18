# TERANETWORK System — Deployment Architecture

> Decision: [D10](decisions.md#d10--one-central-superadmin-over-tailscale). The schema is
> maintained with the numbered SQL migrations in `back/database/migrations/` (no ORM).

## Deployment Decision

The system is a **locally deployed Windows application** using:

- **React/Vite** — frontend, built and served by Express
- **Express/Node.js** — backend/API
- **MySQL** — local database
- **Windows Service** — keeps the backend running automatically
- **Tailscale** — private remote access for authorized internal users
- **Windows Task Scheduler** — automated MySQL backups

The system is intended for **internal users only**: developer, admin, accounting, and technician.

---

## Architecture

```text
                         TAILSCALE
                    Private encrypted network
                              |
             +----------------+----------------+
             |                |                |
          Developer          Admin          Accounting
             |                |                |
             +----------------+----------------+
                              |
                              v
                 CLIENT WINDOWS PC
        +---------------------------------------+
        |                                       |
        |  Tailscale                            |
        |       |                               |
        |       v                               |
        |  Express :8787                        |
        |       |                               |
        |       +-- React/Vite production build |
        |       |                               |
        |       v                               |
        |  MySQL :3306                          |
        |                                       |
        +---------------------------------------+
```

### Multi-branch architecture

Each branch remains a **standalone deployment** with its own Windows PC, Express application, and MySQL database.

The Superadmin portal is **not deployed to each branch**. One Superadmin portal is deployed on the developer/Superadmin PC and can access multiple branches through Tailscale.

```text
                         TAILSCALE TAILNET
                    Private encrypted network
                              |
          +-------------------+-------------------+
          |                   |                   |
       YOUR PC            BRANCH 1            BRANCH 2
    SUPERADMIN PC         WINDOWS PC          WINDOWS PC
          |                   |                   |
          |                   v                   v
          |             Express :8787       Express :8787
          |                   |                   |
          |                 MySQL              MySQL
          |                   |                   |
          |             Branch 1 DB         Branch 2 DB
          |                   |                   |
          +-------------------+-------------------+
                              |
                         BRANCH 3 ...

SUPERADMIN PORTAL
       |
       +--> Branch 1 Express API
       +--> Branch 2 Express API
       +--> Branch 3 Express API
```

The Superadmin portal communicates with branch **Express APIs only**. It never connects directly to branch MySQL databases.

Each branch continues operating normally if the Superadmin PC or another branch is offline.

### Branch independence

There is:

- No central business database.
- No required branch-to-branch synchronization.
- No dependency on the Superadmin portal.
- No direct Superadmin-to-MySQL connection.

Each branch owns its own users, business data, application, database, and backups.

### Superadmin behavior

The Superadmin portal maintains the configured branch API endpoints.

```text
Superadmin Portal
        |
        v
   Select Branch
        |
        +--> Branch 1 API
        |
        +--> Branch 2 API
        |
        +--> Branch 3 API
```

If a branch is unavailable, the portal should show that branch as unavailable while allowing access to other online branches.

### Local access

```text
http://localhost:8787
```

### Remote access

Remote users connect through the client's **Tailscale private network** to the Windows PC running the application.

No public IP, router port forwarding, or publicly exposed MySQL server is required.

---

## Superadmin Portal

The Superadmin portal is a **separate deployment** on the developer/Superadmin PC.

It is not installed on branch PCs.

```text
YOUR PC
|
+-- Tailscale
|
+-- Superadmin Portal
|     |
|     +--> Branch 1 Express API
|     +--> Branch 2 Express API
|     +--> Branch 3 Express API
|
+-- No branch MySQL databases
```

The Superadmin portal is a management layer only. It does not become part of a branch's core runtime.

If the Superadmin PC is offline, every branch continues operating locally and independently.

## Windows Services

### Branch PC

Each branch PC should run:

```text
Windows Services
|
+-- MySQL
|
+-- ISP Billing Backend
|
+-- Tailscale
```

After Windows starts:

1. MySQL starts.
2. Express backend starts.
3. Tailscale starts and reconnects to the private network.
4. Users can access the application.

The backend must run as a Windows Service so users do not need to manually start Node.js.

Use **NSSM** or an equivalent Windows service manager for the Express backend.

### Superadmin PC

The Superadmin portal may also run its Express backend as a Windows Service using NSSM or an equivalent service manager.

It does not require a MySQL service for branch business data.

---

## Application Serving

Build the React frontend for production and have Express serve the generated static files.

```text
Browser
   |
   v
Express
   |
   +--> React static files
   |
   +--> /api/*
            |
            v
          MySQL
```

This keeps the deployment to one application process for the frontend/backend.

---

## MySQL

Use MySQL instead of SQLite.

Recommended configuration:

```text
Host: 127.0.0.1
Port: 3306
Database: isp_billing
User: isp_billing_app
Password: <strong generated secret>
```

### Rules

- Do not use MySQL `root` from the application.
- Create a dedicated application database user.
- Keep MySQL local; do not expose port `3306` to the Internet.
- Use an ORM/migration system so the schema remains maintainable.
- Enforce important constraints at the database level, including unique payment reference numbers.
- Store credentials in environment/configuration, never in source control.

---

## Tailscale

Tailscale is the **only remote access path** for the internal application.

Authorized users:

```text
Developer
Admin
Accounting
Technician
```

Access should be controlled through the Tailscale account/tailnet and its access policies.

### Security boundary

```text
Remote User
    |
    v
Tailscale
    |
    v
Express :8787
    |
    v
MySQL :3306
```

**Never expose MySQL directly to Tailscale users or the public Internet unless there is a specific future requirement.**

The backend is the only component that should communicate with MySQL.

---

## Firewall

Windows Firewall should follow the principle of least exposure.

Required:

- Allow Express application access from the local machine.
- Allow Express access from the Tailscale network as required.
- Allow MySQL only for local backend access.
- Do not create Internet-facing inbound rules for MySQL.
- Do not use router port forwarding for the billing application.

---

## Backups

The original SQLite-specific backup method does not apply to MySQL.

Use scheduled MySQL dumps:

```text
MySQL
  |
  v
mysqldump
  |
  v
dated .sql backup
  |
  +--> external drive
  |
  +--> cloud/synced backup location
```

Recommended:

- Daily automated backup
- Dated backup files
- Keep approximately 30 days of history
- Store backups separately from the live MySQL data
- Test a restore before production handover

Do not rely on the application PC as the only copy of business data.

---

## Deployment Layout

Example:

```text
C:\ISPBilling\
+-- backend\
|   +-- server\
|   +-- frontend-dist\
|   +-- .env
|
+-- backups\
|
+-- logs\
```

MySQL's actual data directory remains managed by the MySQL installation.

---

## Production Startup Flow

```text
Windows Boot
    |
    +--> MySQL Service
    |
    +--> ISP Billing Backend Service
    |       |
    |       +--> React frontend
    |       +--> Express API
    |       +--> MySQL connection
    |
    +--> Tailscale Service
            |
            v
       Private remote access
```

---

## User Experience

### Client office

User opens:

```text
http://localhost:8787
```

### Authorized remote user

User connects through Tailscale and accesses the same Express application over the private network.

There is **one independent application deployment and one database per branch**. Tailscale only provides the private network path between authorized devices.

---

## Security Requirements

- Tailscale authentication required for remote access.
- Tailscale ACLs/grants should restrict branch users to their assigned branch.
- The Superadmin PC may access all managed branch Express endpoints.
- Branch users must not be able to access other branches.
- Application authentication should still be implemented; Tailscale is not a replacement for application login.
- MySQL must not be publicly exposed.
- No router port forwarding for the application.
- Use strong, unique database credentials.
- Keep secrets out of Git.
- Keep Windows accounts/passwords protected.
- Use BitLocker where available.
- Keep Windows, MySQL, Node.js/runtime, backend dependencies, and Tailscale updated.
- Back up the database automatically and test restoration.

---

## Final Stack

```text
BRANCH SYSTEMS
Frontend:        React + Vite
Backend:         Node.js + Express
Database:        MySQL
Local hosting:   Windows PC
Backend service: Windows Service / NSSM
Remote access:   Tailscale
Backups:         mysqldump + Windows Task Scheduler

SUPERADMIN SYSTEM
Frontend:        React + Vite
Backend:         Node.js + Express
Hosting:         Superadmin/Developer PC
Backend service: Windows Service / NSSM
Network:         Tailscale
Database:        No branch business database
```

### Core principle

**Every branch is a standalone local deployment. Each branch owns its own Express application and MySQL database. Tailscale provides the private network between authorized devices and branch servers, while one separate Superadmin portal can remotely manage multiple branches through their Express APIs. There is no central business database and no dependency between branches.**
