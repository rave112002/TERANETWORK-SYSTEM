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

## Timestamp Convention (reinforced from timestamp-convention.md)

All timestamps must use `getCurrentTimestampLocal()` from the project's dateUtils:

```js
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";

const now = getCurrentTimestampLocal();
```

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

## Foreign Key References

Foreign keys reference the **business ID column** (not the auto-increment `id`):

```sql
-- users.companyId references companies.companyId
-- users.branchId references branches.branchId
-- users.roleId references roles.roleId
-- role_permissions.roleId references roles.roleId
-- role_permissions.permissionId references permissions.permissionId
```

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

## Schema Reference

Refer to `database/schema.sql` for the full table definitions. Key tables:

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

---

## Checklist for New Tables

- [ ] Has `id BIGINT PRIMARY KEY AUTO_INCREMENT`
- [ ] Has a business ID column (`varchar(50) UNIQUE NOT NULL`)
- [ ] Business ID is generated via `SELECT UUID()` in application code
- [ ] Has `dateCreated DATETIME NOT NULL` and `dateUpdated DATETIME NOT NULL`
- [ ] Timestamps use `getCurrentTimestampLocal()` from `utils/dateUtils.js`
- [ ] Uses `status` enum with `'Deleted'` for soft deletes (where applicable)
- [ ] Foreign keys reference business ID columns, not auto-increment `id`
