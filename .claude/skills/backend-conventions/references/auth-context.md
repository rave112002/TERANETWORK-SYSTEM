# Authenticated User Context

All protected endpoints receive the authenticated user's data via `req.user`, set by the Passport JWT middleware.

---

## Available on `req.user`

> **Note:** The fields below are a sample based on the current schema. This shape can change anytime depending on what the Passport JWT strategy returns. Always check `server/src/middlewares/passport.jwt.config.js` for the actual `req.user` structure.

| Field       | Type     | Description                            | Available for   |
| ----------- | -------- | -------------------------------------- | --------------- |
| `accountId` | `string` | User's unique UUID                     | All users       |
| `firstName` | `string` | First name                             | All users       |
| `lastName`  | `string` | Last name                              | All users       |
| `email`     | `string` | Email address (from credentials)       | All users       |
| `type`      | `string` | `'SUPERADMIN'`, `'ADMIN'`, or `'USER'` | All users       |
| `systemId`  | `string` | System the user belongs to             | ADMIN/USER only |
| `roleId`    | `string` | Assigned role ID                       | ADMIN/USER only |
| `roleName`  | `string` | Role display name                      | ADMIN/USER only |
| `status`    | `string` | Account status                         | All users       |

Tenancy is a **single level**: `systemId`. There is no second `branchId` axis — the
province → city/municipality hierarchy lives inside the `systems` table itself
(`parentSystemId`), not in a separate table, so a scoped query never joins to resolve a tenant.

---

## Rules

### 1. Never trust client-sent `systemId` / `accountId`

Always use `req.user.systemId` and `req.user.accountId` for scoping queries.
Never accept these from `req.body` or `req.query` for the current user's own context.

```js
// ✅ CORRECT — scope query to the authenticated user's system
const roles = await req.db.query(
  `SELECT * FROM roles WHERE systemId = ? AND status != 'Deleted'`,
  [req.user.systemId],
);

// ❌ WRONG — trusting client-provided systemId
const { systemId } = req.body; // attacker can send any systemId
const roles = await req.db.query(`SELECT * FROM roles WHERE systemId = ?`, [
  systemId,
]);
```

### 2. Scope all data queries by system

Admin portal endpoints must always filter by the user's `systemId` to enforce multi-tenant isolation.

```js
// List users — scoped to the current system
const users = await req.db.query(
  `SELECT * FROM accounts WHERE systemId = ? AND status != 'Deleted'`,
  [req.user.systemId],
);
```

### 3. Superadmin has no system scope

SuperAdmin endpoints query across all systems — they don't have `systemId` on `req.user`.

```js
// SuperAdmin can list all systems
if (req.user.type === "SUPERADMIN") {
  // No system scoping needed
}
```

### 4. Use `req.user.accountId` for audit trails

When logging who performed an action, always reference `req.user.accountId`:

```js
await conn.execute(
  `INSERT INTO audit_trail (action, performedBy, dateCreated) VALUES (?, ?, ?)`,
  [action, req.user.accountId, now],
);
```

### 5. Use `req.user.type` for portal-level access control

```js
// Only allow superadmins to access this endpoint
if (req.user.type !== "SUPERADMIN") {
  return res.sendError("Forbidden", 403);
}
```

---

## Pattern for Admin Endpoints

```js
router.get(
  "/",
  catchAsync(async (req, res) => {
    const { accountId, systemId } = req.user;

    const items = await req.db.query(
      `SELECT * FROM some_table WHERE systemId = ? AND status != 'Deleted'`,
      [systemId],
    );

    return res.sendSuccess("Items retrieved", { items });
  }),
);
```

---

## Pattern for Create Endpoints (auto-assign the system)

When creating resources, always assign `systemId` from `req.user` — never from the request body:

```js
router.post(
  "/",
  validateBody(createSchema),
  catchAsync(async (req, res) => {
    const { systemId, accountId } = req.user;
    const { name, description } = req.body;
    const now = getCurrentTimestampLocal();

    // systemId comes from the authenticated user, NOT from req.body
    await conn.execute(
      `INSERT INTO resources (resourceId, systemId, name, description, createdBy, dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [resourceId, systemId, name, description, accountId, now, now],
    );
  }),
);
```

---

## Do / Don't

**Do:**

- Use `req.user.systemId` for multi-tenant scoping
- Use `req.user.accountId` for audit/ownership
- Use `req.user.type` for portal-level guards
- Treat `req.user` as the single source of truth for the authenticated context

**Don't:**

- Accept `systemId` from the request body for scoping queries
- Accept `accountId` from the client to determine "who is making this request"
- Skip system filtering on Admin portal endpoints
- Assume `req.user` has `systemId` for SuperAdmin users (it doesn't)
