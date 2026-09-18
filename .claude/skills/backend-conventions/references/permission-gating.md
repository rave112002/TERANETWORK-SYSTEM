# Backend Permission Gating Convention

## Rule: Each route group is protected by a single module/submodule permission — same as the frontend page

The permission used on the frontend `<ProtectedRoute>` is the same one the backend checks for write operations on that route group. Never invent separate permissions for sub-actions within the same module.

---

## How It Works

| Route Group          | Permission checked | `read` allows                   | `write` allows                              |
| -------------------- | ------------------ | ------------------------------- | ------------------------------------------- |
| `/admin/users`       | `users.list`       | GET (list, single)              | GET + POST, PUT, DELETE                     |
| `/admin/roles`       | `users.roles`      | GET (list, single, permissions) | GET + POST, PUT, DELETE, assign permissions |
| `/admin/audit-trail` | `audit_trail`      | GET (list)                      | — (read-only module)                        |
| `/admin/settings`    | `settings`         | GET                             | GET + PUT                                   |

---

## Middleware Location

```
server/src/middlewares/checkPermission.middleware.js
```

---

## Middleware Implementation

```js
/**
 * Permission check middleware for RBAC
 * Checks if user has required permission based on module, submodule, and access level
 * Priority: User-specific permissions override role permissions
 */
export const checkPermission = (
  module,
  submodule = null,
  accessLevel = "read",
) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.accountId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      let userAccessLevel = null;
      let permissionSource = null;

      // 1. Check user-specific permissions first (overrides take priority)
      try {
        let userPermQuery = `
          SELECT up.accessLevel
          FROM user_permissions up
          JOIN permissions p ON up.permissionId = p.permissionId
          WHERE up.accountId = ? AND p.module = ? AND p.status = 'Active'
        `;
        let userPermParams = [userId, module];

        if (submodule) {
          userPermQuery += " AND p.submodule = ?";
          userPermParams.push(submodule);
        } else {
          userPermQuery += " AND p.submodule IS NULL";
        }

        const userPermResult = await req.db.query(
          userPermQuery,
          userPermParams,
        );

        if (userPermResult.length > 0) {
          userAccessLevel = userPermResult[0].accessLevel;
          permissionSource = "user";
        }
      } catch (userPermError) {
        console.warn(
          "User permissions check failed, falling back to role permissions:",
          userPermError.message,
        );
      }

      // 2. If no user-specific permission found, check role permissions
      if (!userAccessLevel) {
        const [user] = await req.db.query(
          "SELECT roleId FROM users WHERE accountId = ? AND status != 'Deleted' LIMIT 1",
          [userId],
        );

        if (!user || !user.roleId) {
          return res.status(403).json({
            success: false,
            message: "No role assigned to user",
          });
        }

        let rolePermQuery = `
          SELECT rp.accessLevel
          FROM role_permissions rp
          JOIN permissions p ON rp.permissionId = p.permissionId
          WHERE rp.roleId = ? AND p.module = ? AND p.status = 'Active'
        `;
        let rolePermParams = [user.roleId, module];

        if (submodule) {
          rolePermQuery += " AND p.submodule = ?";
          rolePermParams.push(submodule);
        } else {
          rolePermQuery += " AND p.submodule IS NULL";
        }

        const rolePermResult = await req.db.query(
          rolePermQuery,
          rolePermParams,
        );

        if (rolePermResult.length === 0) {
          return res.status(403).json({
            success: false,
            message: "Insufficient permissions",
            required: submodule
              ? `${module}.${submodule} (${accessLevel})`
              : `${module} (${accessLevel})`,
          });
        }

        userAccessLevel = rolePermResult[0].accessLevel;
        permissionSource = "role";
      }

      // 3. Check access level hierarchy: none < read < write
      const accessLevels = { none: 0, read: 1, write: 2 };

      if (accessLevels[userAccessLevel] < accessLevels[accessLevel]) {
        return res.status(403).json({
          success: false,
          message: "Insufficient access level",
          required: accessLevel,
          current: userAccessLevel,
        });
      }

      // 4. Attach permission info to request for downstream use
      req.userPermission = {
        module,
        submodule,
        accessLevel: userAccessLevel,
        source: permissionSource, // 'user' or 'role'
      };

      next();
    } catch (err) {
      console.error("Permission check error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to check permissions",
      });
    }
  };
};
```

---

## Usage in Controllers

Import and apply before each route handler:

```js
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";

// GET = read
router.get(
  "/",
  checkPermission("users", "roles", "read"),
  catchAsync(async (req, res) => { ... })
);

// POST/PUT/DELETE = write
router.post(
  "/",
  checkPermission("users", "roles", "write"),
  catchAsync(async (req, res) => { ... })
);

router.put(
  "/:roleId",
  checkPermission("users", "roles", "write"),
  catchAsync(async (req, res) => { ... })
);

router.delete(
  "/:roleId",
  checkPermission("users", "roles", "write"),
  catchAsync(async (req, res) => { ... })
);

// Sub-actions use the SAME permission as the parent
router.get(
  "/:roleId/permissions",
  checkPermission("users", "roles", "read"),
  catchAsync(async (req, res) => { ... })
);

router.post(
  "/:roleId/permissions",
  checkPermission("users", "roles", "write"),
  catchAsync(async (req, res) => { ... })
);
```

---

## Rules

### 1. One permission per route group

All endpoints under `/admin/roles` use `users.roles`. Don't create a separate `users.permissions` check for the "assign permissions to role" endpoint — it's an action within the roles module.

### 2. GET = read, mutations = write

| HTTP Method | Minimum access level |
| ----------- | -------------------- |
| GET         | `read`               |
| POST        | `write`              |
| PUT / PATCH | `write`              |
| DELETE      | `write`              |

### 3. Never invent permissions

Only check permissions that exist in the `permissions` table. If a permission isn't seeded, don't reference it.

### 4. The management API uses a key, not permissions

`/api/v1/manage/*` is called by the central SuperAdmin server, not a person (D10). It is gated by
`requireManageKey` (the branch's `MANAGE_API_KEY`), mounted in `routes/route.js`; add no
`checkPermission` there. The old `/api/v1/superadmin/*` routes no longer exist.

### 5. Middleware order in route definition

```js
router.post(
  "/",
  checkPermission("module", "submodule", "write"),  // 1st: permission check
  validateBody(schema),                              // 2nd: validation (optional)
  catchAsync(async (req, res) => { ... })            // 3rd: handler
);
```

### 6. `req.userPermission` is available downstream

After `checkPermission` passes, the handler can access:

```js
req.userPermission = {
  module: "users",
  submodule: "roles",
  accessLevel: "write", // the user's effective level
  source: "role", // 'user' or 'role'
};
```

---

## Do / Don't

**Do:**

- Use the same module/submodule for all endpoints in a route group
- Check `read` for GET, `write` for POST/PUT/DELETE
- Let user_permissions overrides take precedence over role permissions
- Return 403 with a clear message when access is denied
- Apply `checkPermission` before `validateBody` and `catchAsync`

**Don't:**

- Don't invent permission names not in the database
- Don't check different permissions for sub-actions (e.g., "manage permissions" within roles)
- Don't apply permission middleware to management-API routes (they use `requireManageKey`)
- Don't hardcode permission checks inline — always use the middleware
- Don't use `next(new APIError(...))` in the middleware — return `res.status().json()` directly for cleaner error responses

---

## Owner Role Convention

The "Owner" role is system-managed: `npm run db:setup` creates it with the branch's other roles. It must never be visible from the Admin portal.

### Rules

1. **Hide Owner role from Admin portal** — all role list queries: `AND r.roleName != 'Owner'`
2. **Hide Owner users from Admin user list** — all user list queries: `AND r.roleName != 'Owner'` (JOIN roles)
3. **Cannot assign Owner from Admin** — reject if roleId resolves to Owner
4. **Cannot modify/delete Owner from Admin** — reject PUT/DELETE on Owner role
5. **Owner logins are managed from the central SuperAdmin** (Users page → `/api/v1/manage/users`), one per branch
6. **The Owner role is created by `db:setup`** (`scripts/lib/branch-install.js`), with every permission at `write`
