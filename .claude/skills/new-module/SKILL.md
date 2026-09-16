---
name: new-module
description: Scaffold a complete CRUD module across this multi-tenant template — MySQL table + migration, permission row, Zod validator, Express controller with permission gating, route wiring, axios + React Query services, the Modern list page (hooks.jsx + index.jsx), the Sheet form drawer, and sidebar/route registration. Use whenever the user asks to add, create, or scaffold a new module, page, entity, resource, or CRUD feature in the Admin or SuperAdmin portal (e.g. "add a Products module", "new Suppliers page", "scaffold Inventory CRUD"). Also use to add just the backend or just the frontend half of such a module.
---

# New module scaffold

Builds one entity's full vertical slice — backend to sidebar — exactly to this repo's
non-negotiable conventions. `Roles` (`back/.../admin/roles.controller.js` +
`front/src/pages/Admin/UserManagement/Roles/`) is the reference implementation; `Users` is the
reference for the `requests/` service layer, phone fields, and password fields.

## Step 0 — Load the conventions

Read before writing anything (they override anything in this skill if they disagree):

- Repo root `CLAUDE.md` — response envelope, business IDs, soft deletes, phone format
- The **`backend-conventions`** skill, then its
  `references/{schema-conventions,db-patterns,validators,permission-gating,auth-context}.md`
- The **`frontend-conventions`** skill, then its
  `references/{folder-structure,api-guide,hooks-pattern,modern-module-pattern,ui-form-design,ui-design-system,code-conventions}.md`

Skip the half you aren't building (frontend-only → skip `backend-conventions`).

## Step 1 — Pin the spec, then stop

Fill this table and **show it to the user before writing code**. Never guess the field list —
if the user gave only a module name, ask for the fields.

| Slot | Meaning | Example |
| ---- | ------- | ------- |
| `{{Entity}}` | PascalCase singular | `Product` |
| `{{Entities}}` | PascalCase plural (folder, page title) | `Products` |
| `{{entity}}` | camelCase singular | `product` |
| `{{entities}}` | camelCase plural (query key, api file, sendSuccess key) | `products` |
| `{{entityId}}` | business ID column — **never** the auto-increment `id` | `productId` |
| `{{table}}` | MySQL table, lowercase plural | `products` |
| `{{module}}` / `{{submodule}}` | permission slug, snake_case; submodule is `null` for top-level | `products` / `null` |
| `{{portal}}` | `Admin` or `SuperAdmin` | `Admin` |
| `{{route}}` | sidebar path segment | `/products` |
| `{{apiBase}}` | `/api/v1/{{portal-lower}}/{{entities}}` | `/api/v1/admin/products` |
| `{{Icon}}` | one lucide-react icon, reused on header chip + stat card | `Package` |

Plus a **field table** — for each field: column name, MySQL type + nullability, required in the
form?, UI control (Input / Textarea / Select / StatusToggle / PasswordInput / phone), and any
enum values. Every module also gets, automatically: `id`, `{{entityId}}`, `systemId`
(Admin portal only), `status`, `dateCreated`, `dateUpdated`.

**Required-ness must match the DB.** A column that is `NULL` in the schema must NOT be `.min(1)`
in the frontend zod schema — use the shape-not-presence idiom. Confirm each one against the field
table before writing the form.

### Stop and ask if

- The field list is missing or ambiguous (types, enum values, which are required).
- The module needs a permission that doesn't exist yet **and** the DB is already seeded — creating
  it changes existing installs (Step 3 handles it, but confirm the module/submodule slug first).
- The entity is not tenant-scoped (no `systemId`) — that breaks multi-tenant isolation
  and must be a deliberate choice.
- It belongs under an existing parent module (e.g. `UserManagement/`) rather than at the top level.

## Step 2 — Build in this order

Backend first — the frontend's zod schemas and payloads are derived from it. Do not reorder;
each step depends on the one before it.

| # | File | What |
| - | ---- | ---- |
| 1 | `back/database/schema.sql` | add the table (baseline) |
| 2 | `back/database/migrations/NNN_create_{{table}}.sql` | the same table as `CREATE TABLE IF NOT EXISTS`, **plus** the permission INSERT |
| 3 | `back/scripts/setup-database.js` | add the permission to the seed array (fresh installs) |
| 4 | `back/server/src/validators/{{entities}}.validator.js` | create/update/list-query schemas |
| 5 | `back/server/src/controllers/v1/{{portal-lower}}/{{entities}}.controller.js` | GET list, GET one, POST, PUT, DELETE |
| 6 | `back/server/src/routes/v1/{{portal-lower}}/index.js` | mount with `requireAuth` + `auditTrail("{{entities}}")` |
| 7 | `front/src/services/api/{{portal-lower}}/{{entities}}.js` | raw axios, no try/catch |
| 8 | `front/src/services/requests/{{portal-lower}}/{{entities}}.js` | React Query hooks + toasts + invalidation |
| 9 | `front/src/pages/{{portal}}/{{Entities}}/hooks.jsx` | all state, columns, handlers |
| 10 | `front/src/pages/{{portal}}/{{Entities}}/components/{{Entity}}FormDrawer.jsx` | owns its `<Sheet>` |
| 11 | `front/src/pages/{{portal}}/{{Entities}}/index.jsx` | presentational only |
| 12 | `front/src/routes/pageRoutes/{{portal}}Route.jsx` | lazy import + nav entry + `<ProtectedRoute>` |

Copy-paste templates with every placeholder marked:

- **`references/backend.md`** — steps 1–6
- **`references/frontend.md`** — steps 7–12

## Step 3 — The permission row is not optional

A page whose permission isn't in the `permissions` table is invisible to every non-Admin user and
its API returns 403. `setup-database.js` skips seeding entirely when the table is non-empty, so an
already-provisioned DB will never pick up a new entry there — that is why the row goes in **both**
the seed array (fresh installs) and the numbered migration (existing installs). The migration
INSERT must be idempotent (`WHERE NOT EXISTS`). See `references/backend.md` §3.

Grant it to the Admin role too, or the tenant's own admin can't see the page — the migration
template does this.

## Step 4 — Verify before reporting done

Run these and report actual output; do not claim success on unrun checks.

```bash
cd back && npm run lint && cd ../front && npm run lint && npm run build
```

Apply the migration only if the user asks (it writes to their database):

```bash
cd back && npm run db:migrate
```

Then walk the checklist in `references/checklist.md`. Report anything you skipped and why.

## Hard rules (violating any of these means the module is wrong)

- **Envelope** — every response goes through `res.sendSuccess(message, { {{entities}}, pagination })`.
  The frontend unwraps `apiData?.data?.{{entities}}` — one `.data` for axios, one for the envelope.
- **Business IDs only** — API paths, payloads and FKs use `{{entityId}}`. The auto-increment `id`
  never leaves the database.
- **UUIDs come from MySQL** — `SELECT UUID()`, never `crypto.randomUUID()` / `uuidv4()`.
- **Timestamps come from `getCurrentTimestampLocal()`** — never `NOW()`, `new Date()`, or `moment()`
  in application code.
- **Tenant scope from `req.user`** — `systemId` is read off `req.user`, never off
  `req.body`/`req.query`. SuperAdmin routes have neither.
- **Soft delete** — `UPDATE … SET status = 'Deleted'`. No `DELETE FROM`. List queries filter
  `status != 'Deleted'` unless an explicit `?status=` was passed.
- **Transactions** — `let conn;` before `try`, `conn.execute` (destructure `[rows]`) inside,
  `req.db.rollback(conn)` in `catch`, never a manual `conn.release()`. Check-then-insert needs
  `FOR UPDATE` inside the transaction.
- **Validation is middleware** — `validateBody` / `validateQuery` before the handler, never inside
  it. Query filters use `queryEnum` / `queryEnumDefault` / `queryInt` from `_helpers.js` so a
  cleared filter (`?status=`) doesn't 400. Every phone uses `optionalPhone()`.
- **One permission per route group** — GET = `read`, POST/PUT/DELETE = `write`, same
  module/submodule the frontend's `<ProtectedRoute>` uses. SuperAdmin routes get no
  `checkPermission`.
- **shadcn/ui + lucide-react only** — `@/components/ui/*`. No other component or icon library.
- **Never hardcode a hex** — use the `--color-*` tokens. No `bg-white`/`bg-gray-*`/`text-slate-*`,
  no `shadow-*` on static surfaces, no inline `background` on the primary `<Button>`.
- **The form file owns its `<Sheet>`** — props are exactly `{ open, onClose, onSuccess, entity? }`.
- **React Query v5** — `isPending` (not `isLoading`) on mutations; `invalidateQueries({ queryKey })`
  object syntax; `placeholderData: keepPreviousData`.
- **Phone is always `09XX XXXX XXX`** — `zPhone` + `formatPhoneOnChange` + `PHONE_PLACEHOLDER`
  from `utils/phoneFormat.js` on the frontend, `optionalPhone()` on the backend.

## Partial builds

"Just the API for X" → steps 1–6 + Step 4's backend lint. "Just the page for X" → steps 7–12,
after reading the existing controller to confirm the real payload and response keys. "Add a field
to an existing module" → schema.sql + a new numbered migration + validator + controller SQL +
form field + column, in that order.
