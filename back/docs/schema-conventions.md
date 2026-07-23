# Schema & ID Conventions

These conventions apply to all database tables and backend controller code in this project.

---

## Table Structure Convention

Every table MUST follow this structure:

1. **`id`** — `BIGINT PRIMARY KEY AUTO_INCREMENT` — internal surrogate key, never exposed to the frontend.
2. **Business ID** — a separate `varchar(50) UNIQUE NOT NULL` column (e.g., `accountId`, `companyId`, `branchId`, `roleId`, `permissionId`) used in all API responses, URLs, and foreign key references.
3. **Timestamp columns** — `dateCreated DATETIME NOT NULL`, `dateUpdated DATETIME NOT NULL` (see Timestamp section below).

```sql
CREATE TABLE example (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exampleId VARCHAR(50) UNIQUE NOT NULL,
  -- ... other columns ...
  status ENUM('Active','Inactive','Deleted') NOT NULL,
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL
);
```

---

## ID Generation — Always UUID via `SELECT UUID()`

Business IDs (any column ending in `Id` that is NOT the auto-increment `id`) must be generated using `SELECT UUID()` from the database.

### Pattern

```js
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";

// Generate UUID from MySQL
const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
const accountId = uuidRow[0].id;

// For pool queries (non-transaction):
const uuidResult = await req.db.query(`SELECT UUID() as id`);
const companyId = uuidResult[0].id;
```

### Rules

| Rule                            | Description                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Always use `SELECT UUID()`      | Never use `crypto.randomUUID()`, `uuidv4()`, or any JS-side UUID generation                      |
| Generate inside the transaction | When using transactions, generate the UUID with `conn.execute` to keep it on the same connection |
| One UUID per entity             | Generate a fresh UUID for each new row being inserted                                            |

### ✅ Correct

```js
let conn;
try {
  conn = await req.db.beginTransaction();
  const now = getCurrentTimestampLocal();

  // Generate UUID from MySQL
  const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
  const accountId = uuidRow[0].id;

  await conn.execute(
    `INSERT INTO users (accountId, firstName, lastName, status, dateCreated, dateUpdated)
     VALUES (?, ?, ?, 'Active', ?, ?)`,
    [accountId, firstName, lastName, now, now],
  );

  await req.db.commit(conn);
  return res.sendSuccess("User created", { accountId }, 201);
} catch (err) {
  await req.db.rollback(conn);
  throw err;
}
```

### ❌ Wrong

```js
// Never use JS-side UUID libraries
import { v4 as uuidv4 } from "uuid";
const accountId = uuidv4(); // ❌ Wrong

// Never use crypto.randomUUID()
const companyId = crypto.randomUUID(); // ❌ Wrong

// Never hardcode or generate IDs from timestamps/random strings
const roleId = `role_${Date.now()}`; // ❌ Wrong
```

---

## Timestamp Convention

**Storage is Asia/Manila local time.** Use `getCurrentTimestampLocal()` from the
project's dateUtils for every write. `moment().tz("Asia/Manila")` ignores the
server's OS timezone, so timestamps stay Manila no matter where the backend is
deployed. The pool is configured with `timezone: '+08:00'` and `dateStrings: true`,
so the driver performs **no** conversion — the value you store is exactly the value
the API returns and the frontend displays.

```js
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";

const now = getCurrentTimestampLocal();
```

- For a "today" date (e.g. a subscription start), use `getTodayDateLocal()` — never
  SQL `CURDATE()`/`UTC_DATE()` (server-clock dependent).
- To store an inherently-UTC instant (like a JWT's `exp`), convert it with
  `toTimestampLocal(date)`.
- Because reads come back as naive `"YYYY-MM-DD HH:mm:ss"` Manila strings, TTL
  checks can compare them **lexicographically** (`stored.expiresAt <= now`).

> The `*UTC` helpers still exist in dateUtils for explicitly-UTC needs, but are
> **not** used for storage. If you ever need multi-timezone support, switch the
> pool to `timezone: 'Z'` + `dateStrings: false` and use the UTC helpers instead.

### On INSERT — always set both:

```js
await conn.execute(
  `INSERT INTO companies (companyId, name, email, status, dateCreated, dateUpdated)
   VALUES (?, ?, ?, 'Active', ?, ?)`,
  [companyId, name, email, now, now],
);
```

### On UPDATE — always set `dateUpdated`:

```js
await req.db.query(
  `UPDATE companies SET name = ?, dateUpdated = ? WHERE companyId = ? AND status != 'Deleted'`,
  [name, now, companyId],
);
```

### Never use:

- `NOW()` in SQL
- `new Date()` in JS
- `moment()` directly
- Any other timestamp source

---

## Phone Columns

Every phone is a Philippine mobile number stored in the canonical grouped form
**`09XX XXXX XXX`** (11 digits, 4-4-3, e.g. `0912 3456 789`). The column is always:

```sql
phone VARCHAR(20) NULL,
```

`VARCHAR(20)` rather than 13 leaves headroom for legacy rows written before the convention.
Phone is **optional on every table that has it** — `companies`, `branches`, `users`,
`superadmins` — so `NULL` is the "no number" value and controllers write `phone || null`.

Never format or sanitise a phone in a controller. The `optionalPhone()` validator normalises
whatever the client sent (`+63…`, `63…`, `9…`, bare digits, or already-grouped) into the
canonical form before the handler runs, so the DB can only ever hold one shape. See
[validators.md](./validators.md).

---

## Foreign Key References

Foreign keys reference the **business ID column** (not the auto-increment `id`).
They are declared on the tenant hierarchy + permission mappings (see
`database/migrations/002_hardening.sql`):

```sql
-- branches.companyId          → companies.companyId
-- roles.companyId / branchId  → companies.companyId / branches.branchId
-- users.companyId / branchId / roleId → companies / branches / roles
-- role_permissions.roleId / permissionId → roles / permissions
-- user_permissions.accountId / permissionId → users / permissions
```

`ON DELETE RESTRICT` is intentional: rows are soft-deleted (`status = 'Deleted'`),
never physically removed, so a RESTRICT never fires in normal operation.

**Deliberately unconstrained** (polymorphic accountId): `credentials.accountId`,
`superadmins/users.accountId`, `refresh_tokens.accountId`, and all of
`audit_trail` (audit rows must outlive their referents).

---

## Soft Deletes

Tables with a `status` column use soft deletes by setting `status = 'Deleted'` — never physically delete rows.

```js
// Soft delete
const now = getCurrentTimestampLocal();
await req.db.query(
  `UPDATE users SET status = 'Deleted', dateUpdated = ? WHERE accountId = ?`,
  [now, accountId],
);

// Always filter out deleted rows in SELECT queries
`SELECT * FROM users WHERE status != 'Deleted'`;
```

---

## Migrations

The schema is defined by ordered SQL files in `database/migrations/`, applied by a
tracking runner (`scripts/migrate.js`, `_migrations` table) so each runs once:

- `npm run db:migrate` — apply pending migrations
- `npm run db:setup` — migrate **then** seed (additive, re-runnable)
- `npm run db:setup:clean` — drop everything, re-migrate from scratch, seed

**To change the schema, add a new numbered migration** (e.g. `003_*.sql`) — never
edit an applied one. Keep `database/schema.sql` (a full end-state snapshot for
reading) in sync. MySQL DDL auto-commits per statement, so keep each migration
focused.

---

## Schema Reference

`database/schema.sql` is a human-readable snapshot of the **end state**; the source
of truth is `database/migrations/`. Key tables:

| Table              | Business ID        | Purpose                                             |
| ------------------ | ------------------ | --------------------------------------------------- |
| `companies`           | `companyId`          | Multi-tenant company (the company)       |
| `branches`         | `branchId`         | Physical locations under a company                    |
| `superadmins`      | `accountId`        | Platform-level superadmin users                     |
| `credentials`      | `accountId`        | Auth credentials (shared across portals via `type`) |
| `users`            | `accountId`        | Admin/staff users (belong to a company + branch)      |
| `roles`            | `roleId`           | Permission roles (scoped to company + branch)         |
| `permissions`      | `permissionId`     | Master permission definitions                       |
| `role_permissions` | (composite)        | Maps roles → permissions                            |
| `user_permissions` | `userPermissionId` | Per-user permission overrides                       |
| `refresh_tokens`   | `jti`              | Issued refresh tokens (rotation/revocation)         |
| `idempotency_keys` | `idempotencyKey`   | Cached responses for idempotent mutations           |

---

## Checklist for New Tables

- [ ] Added as a new numbered migration in `database/migrations/` (never edit an applied one)
- [ ] Has `id BIGINT PRIMARY KEY AUTO_INCREMENT`
- [ ] Has a business ID column (`varchar(50) UNIQUE NOT NULL`)
- [ ] Business ID is generated via `SELECT UUID()` in application code
- [ ] Has `dateCreated DATETIME NOT NULL` and `dateUpdated DATETIME NOT NULL`
- [ ] Timestamps use `getCurrentTimestampLocal()` from `utils/dateUtils.js` (Asia/Manila storage)
- [ ] Uses `status` enum with `'Deleted'` for soft deletes (where applicable)
- [ ] Foreign keys reference business ID columns, not auto-increment `id`
- [ ] Updated the `database/schema.sql` end-state snapshot to match
