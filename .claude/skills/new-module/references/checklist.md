# Final verification checklist

Walk this before reporting the module done. Anything unchecked gets reported to the user with the
reason — don't silently drop it.

## Backend

- [ ] Table in **both** `database/schema.sql` and a new numbered `database/migrations/NNN_*.sql`,
      describing the same end state (no drift). No previously-applied migration was edited.
- [ ] `id BIGINT PRIMARY KEY AUTO_INCREMENT` + `{{entityId}} VARCHAR(50) UNIQUE NOT NULL` +
      `dateCreated`/`dateUpdated DATETIME NOT NULL`
- [ ] Tenant column `systemId` present (Admin portal) with an FK to the **business ID**
      columns, plus the `idx_*_tenant` index
- [ ] Phone columns are `VARCHAR(20) NULL`; validator `.max()` matches every `varchar(n)`; every
      `z.enum` matches the column's ENUM exactly
- [ ] Permission row inserted idempotently in the migration **and** added to the
      `setup-database.js` seed array; granted to the `Admin` role
- [ ] Validator file `{{entities}}.validator.js` exists with create / update / list-query schemas
- [ ] Optional fields use `optionalString` / `optionalEmail` / `optionalPhone`, never a bare
      `.optional().nullable()`; query filters use `queryEnum` / `queryEnumDefault` / `queryInt`
- [ ] Every POST/PUT/PATCH has `validateBody`; the list GET has `validateQuery`
- [ ] `checkPermission("{{module}}", {{submodule}}, "read")` on GETs and `"write"` on mutations —
      the same slug the frontend uses; sub-actions reuse the parent's permission
      (SuperAdmin routes: no `checkPermission` at all)
- [ ] Middleware order is `checkPermission` → `validate*` → `catchAsync`
- [ ] IDs from `SELECT UUID()`; timestamps from `getCurrentTimestampLocal()` — no
      `crypto.randomUUID()`, `uuidv4()`, `NOW()`, `new Date()`, or `moment()` in app code
- [ ] `systemId` read from `req.user` only — never from `req.body`/`req.query`
- [ ] Every query filters `status != 'Deleted'` unless an explicit `?status=` was passed; DELETE is
      a soft delete (`status = 'Deleted'`), never `DELETE FROM`
- [ ] Transactions: `let conn;` before `try`, `conn.execute` with `[rows]` destructured,
      `req.db.rollback(conn)` in `catch`, `req.db.commit(conn)` before success, no manual
      `conn.release()`; check-then-insert uses `FOR UPDATE` in the same transaction
- [ ] Sort column whitelisted before interpolation (it is not a bound parameter)
- [ ] Responses go through `res.sendSuccess(msg, { {{entities}}, pagination })` / `res.sendError`
- [ ] Router mounted in `routes/v1/{{portal-lower}}/index.js` with `requireAuth` and
      `auditTrail("{{entities}}")`

## Frontend

- [ ] `services/api/{{portal-lower}}/{{entities}}.js` — raw axios, no try/catch, no hooks
- [ ] `services/requests/{{portal-lower}}/{{entities}}.js` — React Query hooks; toasts and
      `invalidateQueries({ queryKey })` (object syntax) live here, not in components
- [ ] Page folder is `pages/{{portal}}/{{Entities}}/` with `index.jsx`, `hooks.jsx`, `components/`;
      no barrel `index.js` re-exports
- [ ] `hooks.jsx` exports one hook holding all state, `useMemo`'d columns, `useCallback`'d
      handlers; search runs through `useDebounce(…, 500)`; filters reset `current` to 1
- [ ] `index.jsx` has no `useState` except `isFilterVisible`, and imports no React Query hook
      directly
- [ ] Data unwrapped as `apiData?.data?.{{entities}}` (two `.data` hops)
- [ ] Layout: `p-8 space-y-5` → `PageHeader` → stat-card grid → one bordered card
      (`1px solid var(--color-line)`, `var(--radius-card)`, **no shadow**) with the toolbar inside
- [ ] `DataTable` + `PaginationFooter` (no built-in pager); filter `Select` uses the `"all"`
      sentinel mapped to `""`
- [ ] Columns: `#` mono · initial-avatar + name · secondary text · status dot · `⋮` via
      `RowActions`; sentence-case headers; strings through `decodeHTML()`; phones through
      `formatPhoneDisplay()`
- [ ] `⋮` menu order is primary action, Edit, `{ type: "divider" }`, Delete (`danger: true`), and
      delete goes through `confirm()` from `store/confirmStore`
- [ ] Form drawer owns its `<Sheet>`, props are exactly `{ open, onClose, onSuccess, entity? }`,
      has the `sr-only` `<SheetTitle>` and `showCloseButton={false}` + its own bordered X
- [ ] zod schema required-ness matches the DB; optional fields validate shape-not-presence;
      required labels render an explicit `*`
- [ ] Hydration via explicit `form.reset({...})` (never `form.reset(entity)`); dirty check via
      `formState.isDirty`; submit maps the payload explicitly with `value || null` for optionals
- [ ] Mutations use `isPending` (not `isLoading`)
- [ ] Phone fields use `PHONE_PLACEHOLDER` + `PHONE_MAX_LENGTH` + `formatPhoneOnChange` + `zPhone`
- [ ] `canWrite` from `usePermissions` gates the create button, `⋮` actions, and row selection
      (SuperAdmin pages: no permission gating)
- [ ] Route registered in `{{portal}}Route.jsx`: lazy import + nav entry + `<ProtectedRoute
      accessLevel="read">` inside `<Suspense>`; parent's `permission.anyOf` updated if nested
- [ ] The `module`/`submodule` strings match across the seed, `checkPermission`, `ProtectedRoute`,
      the nav `permission`, and `hasPermission` — character for character
- [ ] Only shadcn/ui (`@/components/ui/*`) and lucide-react; no hardcoded hex, no
      `bg-white`/`bg-gray-*`/`text-slate-*`, no `shadow-*` on static surfaces, no inline
      `background` on the primary `<Button>`, no gradient except the form header chip
- [ ] No leftover `console.log`

## Commands

```bash
cd back && npm run lint
```

```bash
cd front && npm run lint && npm run build
```

Migration — only when the user asks, since it writes to their database:

```bash
cd back && npm run db:migrate
```

## Report

State what was created (file list), what the lint/build actually said, whether the migration was
applied or is still pending, and anything the user must do by hand (e.g. granting the new
permission to non-Admin roles via the Roles page).
