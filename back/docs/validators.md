# Validators Convention

Every POST, PUT, PATCH endpoint MUST have request validation using Zod schemas.
Validators are applied via `validateBody`, `validateQuery`, or `validateParams` middleware from `utils/catchAsync.js`.

---

## Folder Structure

Validator files live flat in `server/src/validators/`, one per controller, named `<name>.validator.js`:

```
server/src/validators/
└── auth.validator.js        # validators for auth.controller.js
```

> **Current state:** every mutating controller is validated. Validator files:
> `auth`, `admin-users`, `roles`, `permissions`, `user-permissions`, `audit-trail`,
> `companies`, `branches`, `superadmin-users`, `upload`, plus shared helpers in
> `_helpers.js` (`emptyToUndefined` / `optionalString` / `optionalEmail` — Ant Design
> forms and multipart both send `""` for cleared optional fields). When you add a new
> controller, create a sibling `<name>.validator.js`. If two portals share a controller
> base name, disambiguate the file (e.g. `admin-users.validator.js`).
>
> **Multipart routes** (company create/update, uploads): place `validateBody` **after**
> the multer middleware (`upload.single()` / `compressImage`) so `req.body` is populated.
> Validation errors return `400` with `{ success, message, code: "VALIDATION_FAILED", errors }`.

**Rule:** The validator file name matches the controller file name — replace `.controller.js` with `.validator.js`.

---

## Import Pattern

```js
// In the controller file
import { validateBody, validateQuery, validateParams } from "../../../utils/catchAsync.js";
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from "../../../validators/users.validator.js";
```

---

## Schema Naming Convention

| HTTP Method             | Schema Name Pattern       | Middleware                            |
| ----------------------- | ------------------------- | ------------------------------------- |
| POST (create)           | `create[Entity]Schema`    | `validateBody(createUserSchema)`      |
| PUT (update)            | `update[Entity]Schema`    | `validateBody(updateUserSchema)`      |
| PATCH (partial)         | `patch[Entity]Schema`     | `validateBody(patchUserSchema)`       |
| GET (list with filters) | `list[Entity]QuerySchema` | `validateQuery(listUsersQuerySchema)` |
| Route params            | `[entity]ParamsSchema`    | `validateParams(userParamsSchema)`    |

---

## Usage in Routes

```js
// POST — always validate body
router.post(
  "/",
  validateBody(createUserSchema),
  catchAsync(async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    // req.body is now typed and sanitized by Zod
  })
);

// PUT — always validate body
router.put(
  "/:userId",
  validateBody(updateUserSchema),
  catchAsync(async (req, res) => {
    const { firstName, lastName, status } = req.body;
  })
);

// GET with query filters — validate query params
router.get(
  "/",
  validateQuery(listUsersQuerySchema),
  catchAsync(async (req, res) => {
    const { page, pageSize, search, status } = req.query;
  })
);
```

---

## Validator File Template

```js
import { z } from "zod";
import { optionalPhone } from "./_helpers.js";

// POST /
export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().email("Invalid email address").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(255),
  companyId: z.string().min(1, "Company ID is required").max(50),
  branchId: z.string().min(1, "Branch ID is required").max(50),
  roleId: z.string().min(1, "Role ID is required").max(50),
  phone: optionalPhone(),
});

// PUT /:userId
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: optionalPhone(),
  roleId: z.string().min(1).max(50),
  status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
});

// GET / query params
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(100).default(""),
  status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
  sortBy: z.enum(["dateCreated", "dateUpdated", "firstName", "lastName"]).default("dateCreated"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});
```

---

## Shared helpers — `validators/_helpers.js`

Never hand-roll an optional field. Clients send **three different things** for "no value":
Ant Design forms send `""`, JSON payloads send `null`, and a cleared field may be omitted
entirely. Every helper below normalises all three to `undefined` before the inner schema runs,
so a "cleared" field never trips a type error.

| Helper | Use for | Notes |
| ------ | ------- | ----- |
| `emptyToUndefined(schema)` | the primitive the others are built on | `""` **and** `null` → `undefined` |
| `optionalString(max)` | any nullable `VARCHAR`/`TEXT` column | |
| `optionalEmail(max)` | nullable email columns | |
| `optionalPhone()` | **every** `phone` column | validates *and* normalises — see below |
| `queryEnum(values)` | a `?status=` style filter | `?status=` (empty) means "no filter", not an error |
| `queryEnumDefault(values, d)` | a filter with a default | |
| `queryInt(default, {min, max})` | `?page=` / `?pageSize=` | `?page=` falls back to the default, not `NaN` |

> The `query*` helpers exist because a form that clears a filter still submits the key with an
> empty value. A bare `z.enum([...]).optional()` rejects `""` and the whole list 400s.

### `optionalPhone()` — the only way to validate a phone

Phone is canonical **`09XX XXXX XXX`** across the stack (see the repo-root `CLAUDE.md`).
`optionalPhone()` accepts the grouped form, bare `09XXXXXXXXX`, and `+63` / `63` / `9…`
variants, then **transforms the value to `09XX XXXX XXX` before the controller sees it** — so
the DB only ever holds the canonical form and controllers never format.

```js
import { optionalPhone } from "./_helpers.js";

export const createUserSchema = z.object({
  // ...
  phone: optionalPhone(), // "+639123456789" → "0912 3456 789"
});
```

Phone columns are `VARCHAR(20) NULL` and phone is optional everywhere, so `""`, `null`, and an
omitted key all mean "no number" and all pass. The controller writes `phone || null`.

---

## Rules

1. **Every POST/PUT/PATCH** endpoint MUST have a `validateBody()` middleware before the handler.
2. **String length limits** must match the database column size (e.g., `varchar(50)` → `.max(50)`).
3. **Enum fields** must use `z.enum([...])` matching the database ENUM values exactly.
4. **Optional/nullable** fields use a `_helpers.js` helper (`optionalString` / `optionalEmail` /
   `optionalPhone`) — a bare `.optional().nullable()` still rejects the `""` that Ant Design
   forms actually send.
5. **Required fields** use `.min(1, "Field is required")` — match NOT NULL constraints.
6. **Query params** that are numbers use `z.coerce.number()` (query strings are always strings).
7. **Never validate inside the handler** — always use middleware so validation errors return 400 before touching the database.
8. **Never trust `req.body` without validation** — even for simple endpoints.

---

## Checklist for New Endpoints

- [ ] Created validator file in `server/src/validators/[entity].validator.js`
- [ ] Exported named schema matching the naming convention
- [ ] Applied `validateBody()` / `validateQuery()` middleware in the route
- [ ] String `.max()` matches DB column varchar length
- [ ] Enums match DB ENUM values exactly
- [ ] Required fields have `.min(1)` with error message
- [ ] Optional fields use a `_helpers.js` helper, not a bare `.optional().nullable()`
- [ ] Every `phone` field uses `optionalPhone()`
- [ ] Every query filter uses `queryEnum` / `queryEnumDefault` / `queryInt` (so `?status=` doesn't 400)
