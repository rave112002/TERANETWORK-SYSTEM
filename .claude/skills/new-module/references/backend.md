# Backend templates — steps 1–6

Placeholders from SKILL.md Step 1. Examples use `Product` / `products` / `productId`.

---

## 1. Table in `back/database/schema.sql`

Add near the related tables, following the file's top-to-bottom read order.

```sql
-- ============================================================
-- {{ENTITIES}} — <one-line purpose>
-- ============================================================
CREATE TABLE IF NOT EXISTS {{table}} (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  {{entityId}} VARCHAR(50) NOT NULL UNIQUE,
  companyId VARCHAR(50) NOT NULL,
  branchId VARCHAR(50) NOT NULL,

  -- ── module fields ──
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  phone VARCHAR(20) NULL,

  status ENUM('Active','Inactive','Deleted') NOT NULL DEFAULT 'Active',
  dateCreated DATETIME NOT NULL,
  dateUpdated DATETIME NOT NULL,
  INDEX idx_{{table}}_companyId (companyId),
  INDEX idx_{{table}}_branchId (branchId),
  INDEX idx_{{table}}_tenant (companyId, branchId, status),
  CONSTRAINT fk_{{table}}_company FOREIGN KEY (companyId) REFERENCES companies(companyId),
  CONSTRAINT fk_{{table}}_branch  FOREIGN KEY (branchId)  REFERENCES branches(branchId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Rules: `id` + business ID + `dateCreated`/`dateUpdated` always. FKs reference **business ID**
columns. `ON DELETE RESTRICT` (the default) is intentional — rows are soft-deleted.
`status` includes `'Deleted'` unless the entity genuinely only toggles Active/Inactive (like
`roles`, which soft-deletes to `'Inactive'`). SuperAdmin-owned entities drop `branchId` (and
`companyId` if platform-wide) along with their FKs and indexes.

Column lengths must match the validator's `.max()` exactly. Phone columns are always
`VARCHAR(20) NULL`.

---

## 2. Migration `back/database/migrations/NNN_create_{{table}}.sql`

`NNN` = next unused 3-digit prefix (`ls back/database/migrations`; start at `001`). The baseline
covers databases provisioned from scratch; this covers ones that already recorded `schema.sql` as
applied and will never re-run it. **Both must describe the same end state.** Never edit a
migration that has already been applied.

```sql
-- NNN_create_{{table}}.sql
-- Adds the {{entities}} table and its ADMIN permission.
-- MySQL DDL auto-commits per statement — keep this migration focused.

CREATE TABLE IF NOT EXISTS {{table}} (
  -- …identical to schema.sql above…
);

-- Permission row (idempotent — safe to re-run, and matches what setup-database.js seeds)
INSERT INTO permissions (permissionId, module, submodule, description, portal, status, dateCreated, dateUpdated)
SELECT UUID(), '{{module}}', NULL, '{{Entities}} management', 'ADMIN', 'Active',
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'),
       CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE module = '{{module}}' AND submodule IS NULL
);

-- Grant it to every existing Owner role at write level, so each tenant's owner sees the page
INSERT INTO role_permissions (roleId, permissionId, accessLevel, dateCreated)
SELECT r.roleId, p.permissionId, 'write', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00')
FROM roles r
CROSS JOIN permissions p
WHERE r.roleName = 'Owner'
  AND p.module = '{{module}}' AND p.submodule IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.roleId = r.roleId AND rp.permissionId = p.permissionId
  );
```

For a **submodule** permission, swap `submodule` from `NULL` to `'{{submodule}}'` and change both
`submodule IS NULL` clauses to `submodule = '{{submodule}}'`.

> `CONVERT_TZ(UTC_TIMESTAMP(), …)` is the SQL-file equivalent of
> `getCurrentTimestampLocal()` — it lands in Asia/Manila regardless of the migration runner's
> session timezone. Application code still uses the JS helper, never raw SQL time functions.

---

## 3. Seed array in `back/scripts/setup-database.js`

Add one line so fresh installs (`npm run db:setup`) get the permission. The block is skipped when
`permissions` is already non-empty — which is exactly why step 2 also inserts it.

```js
const permissions = [
  { module: "dashboard", submodule: null, description: "Dashboard access" },
  // …existing…
  { module: "{{module}}", submodule: null, description: "{{Entities}} management" },
];
```

---

## 4. Validator `back/server/src/validators/{{entities}}.validator.js`

One file per controller, named after it. Never hand-roll an optional field — clients send `""`,
`null`, or omit the key for the same "no value", and only the `_helpers.js` wrappers accept all
three.

```js
import { z } from "zod";
import {
  optionalString,
  optionalPhone,
  queryEnum,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

// POST / — create
export const create{{Entity}}Schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: optionalString(1000),
  phone: optionalPhone(),
});

// PUT /:{{entityId}} — update
export const update{{Entity}}Schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: optionalString(1000),
  phone: optionalPhone(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

// GET / — list query params (a cleared filter arrives as "", see _helpers.js)
export const list{{Entities}}QuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(["Active", "Inactive", "Deleted"]),
  sortBy: queryEnumDefault(["dateCreated", "dateUpdated", "name"], "dateCreated"),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
```

`.max(n)` mirrors the column's `varchar(n)`. `z.enum([...])` mirrors the column's ENUM values
exactly. Required fields use `.min(1, "… is required")` and mirror `NOT NULL`.

---

## 5. Controller `back/server/src/controllers/v1/{{portal-lower}}/{{entities}}.controller.js`

An Express `Router` exported as default. Middleware order per route:
`checkPermission` → `validateBody`/`validateQuery` → `catchAsync(handler)`.

```js
import express from "express";
import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import {
  create{{Entity}}Schema,
  update{{Entity}}Schema,
  list{{Entities}}QuerySchema,
} from "../../../validators/{{entities}}.validator.js";

const router = express.Router();

/**
 * GET /
 * List {{entities}} (scoped to the authenticated user's company/branch)
 */
router.get(
  "/",
  checkPermission("{{module}}", null, "read"),
  validateQuery(list{{Entities}}QuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId, branchId } = req.user;
    const offset = (page - 1) * pageSize;

    const params = [companyId, branchId];
    let whereClause = "WHERE t.companyId = ? AND t.branchId = ?";

    // No status filter → hide soft-deleted. Explicit ?status=Deleted → show them.
    if (status) {
      whereClause += " AND t.status = ?";
      params.push(status);
    } else {
      whereClause += " AND t.status != 'Deleted'";
    }

    if (search) {
      whereClause += " AND (t.name LIKE ? OR t.description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    // Whitelist the sort column — it is interpolated, not bound.
    const allowedSortColumns = ["dateCreated", "dateUpdated", "name"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, {{entities}}] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM {{table}} t ${whereClause}`, params),
      req.db.query(
        `SELECT t.{{entityId}}, t.companyId, t.branchId, t.name, t.description, t.phone,
                t.status, t.dateCreated, t.dateUpdated
         FROM {{table}} t
         ${whereClause}
         ORDER BY t.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);
    const total = countRows[0]?.total || 0;

    return res.sendSuccess("{{Entities}} retrieved successfully", {
      {{entities}},
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

/**
 * GET /:{{entityId}}
 */
router.get(
  "/:{{entityId}}",
  checkPermission("{{module}}", null, "read"),
  catchAsync(async (req, res) => {
    const { {{entityId}} } = req.params;
    const { companyId, branchId } = req.user;

    const rows = await req.db.query(
      `SELECT {{entityId}}, companyId, branchId, name, description, phone,
              status, dateCreated, dateUpdated
       FROM {{table}}
       WHERE {{entityId}} = ? AND companyId = ? AND branchId = ? AND status != 'Deleted'
       LIMIT 1`,
      [{{entityId}}, companyId, branchId]
    );

    if (rows.length === 0) {
      return res.sendError("{{Entity}} not found", 404);
    }

    return res.sendSuccess("{{Entity}} retrieved successfully", { {{entity}}: rows[0] });
  })
);

/**
 * POST /
 * Check-then-insert must share one transaction with FOR UPDATE, or two concurrent
 * requests both pass the duplicate check before either inserts.
 */
router.post(
  "/",
  checkPermission("{{module}}", null, "write"),
  validateBody(create{{Entity}}Schema),
  catchAsync(async (req, res) => {
    const { name, description, phone } = req.body;
    const { companyId, branchId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const {{entityId}} = uuidRow[0].id;

      const [existing] = await conn.execute(
        `SELECT {{entityId}} FROM {{table}}
         WHERE name = ? AND companyId = ? AND branchId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [name, companyId, branchId]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("A {{entity}} with this name already exists", 409);
      }

      await conn.execute(
        `INSERT INTO {{table}}
           ({{entityId}}, companyId, branchId, name, description, phone, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [{{entityId}}, companyId, branchId, name, description || null, phone || null, now, now]
      );

      await req.db.commit(conn);
      return res.sendSuccess("{{Entity}} created successfully", { {{entityId}} }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:{{entityId}}
 */
router.put(
  "/:{{entityId}}",
  checkPermission("{{module}}", null, "write"),
  validateBody(update{{Entity}}Schema),
  catchAsync(async (req, res) => {
    const { {{entityId}} } = req.params;
    const { name, description, phone, status } = req.body;
    const { companyId, branchId } = req.user;
    const now = getCurrentTimestampLocal();

    const result = await req.db.query(
      `UPDATE {{table}}
       SET name = ?, description = ?, phone = ?, status = ?, dateUpdated = ?
       WHERE {{entityId}} = ? AND companyId = ? AND branchId = ? AND status != 'Deleted'`,
      [name, description || null, phone || null, status || "Active", now,
       {{entityId}}, companyId, branchId]
    );

    if (result.affectedRows === 0) {
      return res.sendError("{{Entity}} not found", 404);
    }

    return res.sendSuccess("{{Entity}} updated successfully");
  })
);

/**
 * DELETE /:{{entityId}} — soft delete
 */
router.delete(
  "/:{{entityId}}",
  checkPermission("{{module}}", null, "write"),
  catchAsync(async (req, res) => {
    const { {{entityId}} } = req.params;
    const { companyId, branchId } = req.user;
    const now = getCurrentTimestampLocal();

    const result = await req.db.query(
      `UPDATE {{table}} SET status = 'Deleted', dateUpdated = ?
       WHERE {{entityId}} = ? AND companyId = ? AND branchId = ? AND status != 'Deleted'`,
      [now, {{entityId}}, companyId, branchId]
    );

    if (result.affectedRows === 0) {
      return res.sendError("{{Entity}} not found", 404);
    }

    return res.sendSuccess("{{Entity}} deleted successfully");
  })
);

export default router;
```

### Return-shape trap

- `req.db.query(...)` → **rows directly** (`rows[0]`, `rows.length`, `result.affectedRows`)
- `conn.execute(...)` → **`[rows, fields]`** — always destructure `const [rows] = …`

Mixing them silently returns a `FieldPacket` where you expected a row. Never call `req.db.query`
inside a transaction — it takes a different connection and isn't part of it.

### SuperAdmin variant — obsolete (D10)

The in-branch SuperAdmin portal and `routes/v1/superadmin/` were removed. Something the central
SuperAdmin needs from a branch is a management-API endpoint under `controllers/v1/manage/`
(behind `requireManageKey`, audited with `manageAuditContext`), plus a pass-through route in
`superadmin-server/`. The text below is kept for reference only.


Drop every `checkPermission` (SuperAdmin has unrestricted access by design) and drop the
`companyId`/`branchId` scoping — `req.user` carries neither. When SuperAdmin acts on a specific
tenant's rows, take the tenant ID from `req.params`/`req.body`, and mount the router behind
`requireSuperAdmin`.

### Sub-actions

Nested endpoints (`GET /:{{entityId}}/things`) use the **same** `{{module}}`/`{{submodule}}`
permission as the parent group — never a new one.

---

## 6. Route wiring `back/server/src/routes/v1/{{portal-lower}}/index.js`

```js
import {{entities}}Controller from "../../../controllers/v1/admin/{{entities}}.controller.js";

// …with the other protected mounts:
router.use("/{{entities}}", requireAuth, auditTrail("{{entities}}"), {{entities}}Controller);
```

`requireAuth` is the file's `passport.authenticate("jwt", { session: false })`. Include
`auditTrail("{{entities}}")` for anything that mutates tenant data; read-only modules (like
`audit-trail` itself) omit it. SuperAdmin mounts live in `routes/v1/superadmin/index.js`.
