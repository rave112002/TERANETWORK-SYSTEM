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
| `brandId`   | `string` | Brand the user belongs to              | ADMIN/USER only |
| `branchId`  | `string` | Branch the user belongs to             | ADMIN/USER only |
| `roleId`    | `string` | Assigned role ID                       | ADMIN/USER only |
| `roleName`  | `string` | Role display name                      | ADMIN/USER only |
| `status`    | `string` | Account status                         | All users       |

---

## Rules

### 1. Never trust client-sent `brandId` / `branchId` / `accountId`

Always use `req.user.brandId`, `req.user.branchId`, `req.user.accountId` for scoping queries.
Never accept these from `req.body` or `req.query` for the current user's own context.

```js
// ✅ CORRECT — scope query to the authenticated user's brand
const roles = await req.db.query(
  `SELECT * FROM roles WHERE brandId = ? AND branchId = ? AND status != 'Deleted'`,
  [req.user.brandId, req.user.branchId],
);

// ❌ WRONG — trusting client-provided brandId
const { brandId } = req.body; // attacker can send any brandId
const roles = await req.db.query(`SELECT * FROM roles WHERE brandId = ?`, [
  brandId,
]);
```

### 2. Scope all data queries by brand/branch

Admin portal endpoints must always filter by the user's `brandId` and/or `branchId` to enforce multi-tenant isolation.

```js
// List users — scoped to current brand/branch
const users = await req.db.query(
  `SELECT * FROM users WHERE brandId = ? AND branchId = ? AND status != 'Deleted'`,
  [req.user.brandId, req.user.branchId],
);
```

### 3. Superadmin has no brand/branch scope

SuperAdmin endpoints query across all brands — they don't have `brandId`/`branchId` on `req.user`.

```js
// SuperAdmin can list all brands
if (req.user.type === "SUPERADMIN") {
  // No brand/branch scoping needed
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
    const { accountId, brandId, branchId } = req.user;

    const items = await req.db.query(
      `SELECT * FROM some_table WHERE brandId = ? AND branchId = ? AND status != 'Deleted'`,
      [brandId, branchId],
    );

    return res.sendSuccess("Items retrieved", { items });
  }),
);
```

---

## Pattern for Create Endpoints (auto-assign brand/branch)

When creating resources, always assign `brandId` and `branchId` from `req.user` — never from the request body:

```js
router.post(
  "/",
  validateBody(createSchema),
  catchAsync(async (req, res) => {
    const { brandId, branchId, accountId } = req.user;
    const { name, description } = req.body;
    const now = getCurrentTimestampLocal();

    // brandId and branchId come from the authenticated user, NOT from req.body
    await conn.execute(
      `INSERT INTO resources (resourceId, brandId, branchId, name, description, createdBy, dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [resourceId, brandId, branchId, name, description, accountId, now, now],
    );
  }),
);
```

---

## Do / Don't

**Do:**

- Use `req.user.brandId` and `req.user.branchId` for multi-tenant scoping
- Use `req.user.accountId` for audit/ownership
- Use `req.user.type` for portal-level guards
- Treat `req.user` as the single source of truth for the authenticated context

**Don't:**

- Accept `brandId`/`branchId` from request body for scoping queries
- Accept `accountId` from the client to determine "who is making this request"
- Skip brand/branch filtering on Admin portal endpoints
- Assume `req.user` has `brandId`/`branchId` for SuperAdmin users (it doesn't)
