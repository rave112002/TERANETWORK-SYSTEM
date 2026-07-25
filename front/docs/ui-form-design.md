# UI Form Design — "Modern" Sheet Form Pattern

When building or editing any create/edit form, follow this pattern.

> Reference implementation: **`src/pages/Admin/UserManagement/Roles/components/RoleFormDrawer.jsx`**
> (simple) and **`.../Users/components/UserFormDrawer.jsx`** (phone, password, select, grid).
> Forms use **react-hook-form + zod** inside a shadcn **`<Sheet>`**.

---

## When to use

Apply for drawer-based create/edit forms in admin modules. Skip for inline edits, single-field
filters, and read-only detail views (those use a `<Dialog>` — see UI Design System).

---

## The architectural rule (NON-NEGOTIABLE)

**The form file owns the Sheet. The parent is dumb.**

**Form file** (`XFormDrawer.jsx`):

- Imports `Sheet`, `SheetContent`, `SheetTitle` from `@/components/ui/sheet`; the component name
  ends in `FormDrawer`.
- Props are exactly `{ open, onClose, onSuccess, entity? }` — in that order. No `onCancel`,
  no `visible`, no `isEditMode` from outside. `entity` presence flips edit mode internally.
- Renders a right-side sheet as its root:

```jsx
<Sheet open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
  <SheetContent
    side="right"
    showCloseButton={false}          {/* we render our own bordered X */}
    className="w-full gap-0 p-0 sm:max-w-[800px]"
    style={{ background: "var(--color-surface)" }}
  >
    <SheetTitle className="sr-only">{isEditMode ? "Edit X" : "Create New X"}</SheetTitle>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto p-6">{/* header + fields */}</div>
        <div className="p-6 pt-5 …footer…">{/* Cancel + submit */}</div>
      </form>
    </Form>
  </SheetContent>
</Sheet>
```

**Parent**: holds `open` state and renders
`<XFormDrawer open={...} onClose={...} onSuccess={...} entity={...} />`. It **never** wraps the
form in its own Sheet. A `SheetTitle` (visually hidden with `sr-only`) is required for
accessibility — Radix warns without one.

---

## Form setup — react-hook-form + zod

One `zod` schema per form, wired through `zodResolver`. `defaultValues` are always concrete (never
`undefined`), and hydration/reset go through `form.reset()`.

```jsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const roleSchema = z.object({
  roleName: z.string().trim().min(3, "Role name must be at least 3 characters").max(50, "…"),
  // optional: validate length only once something is typed (empty string passes)
  description: z
    .string()
    .max(500, "…")
    .refine((v) => v === "" || v.length >= 10, "Description must be at least 10 characters"),
  status: z.enum(["Active", "Inactive"]),
});

const EMPTY = { roleName: "", description: "", status: "Active" };

const form = useForm({ resolver: zodResolver(roleSchema), defaultValues: EMPTY });
const { formState: { isDirty } } = form;
```

### Required-ness must match the backend

**A field is required in the schema only if the backend actually requires it** — DB column
`NOT NULL` or the API rejects it when missing. Check `back/database/schema.sql` and the controller;
don't guess. Known-optional fields — never make these required: `description` (`TEXT NULL`),
`phone` (`VARCHAR(20) NULL`). Validate **shape, not presence** on optional fields with the
`.refine((v) => v === "" || …)` idiom above.

### Required asterisks are manual

shadcn's `<FormLabel>` does **not** auto-render a `*`. For required fields add one explicitly so
users see it:

```jsx
const req = <span style={{ color: "var(--color-error)" }}>*</span>;
<FormLabel>Role name {req}</FormLabel>
```

---

## Anatomy

### 1. Header — accent chip + title + subtitle + bordered X

We render our own X (`showCloseButton={false}` on `SheetContent`); the gradient chip is the one
place a gradient is allowed.

```jsx
<div className="flex items-start justify-between gap-3 mb-7">
  <div className="flex items-center gap-3 min-w-0">
    <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
      <Shield className="w-[22px] h-[22px] text-white" />
    </span>
    <div className="min-w-0">
      <h2 className="m-0 font-semibold leading-tight" style={{ fontSize: 19, color: "var(--color-text-dark)" }}>
        {isEditMode ? "Edit Role" : "Create New Role"}
      </h2>
      <p className="m-0 mt-0.5" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
        {isEditMode ? "Update role information" : "Define a new role for your company"}
      </p>
    </div>
  </div>
  <button
    type="button"
    onClick={handleClose}
    aria-label="Close"
    className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--color-line)", color: "var(--color-text-secondary)" }}
  >
    <X className="w-[18px] h-[18px]" />
  </button>
</div>
```

### 2. Sections — `SectionLabel`, not a divider

```jsx
import SectionLabel from "…/components/SectionLabel";

<SectionLabel>Role details</SectionLabel>
{/* fields */}
<div className="mt-7">
  <SectionLabel>Access status</SectionLabel>
  {/* fields */}
</div>
```

### 3. Fields — `<FormField>` + shadcn inputs

Each field is a `FormField` render prop giving you `field` (`value`, `onChange`, `onBlur`, `name`,
`ref`). Inputs are `h-10` (the large control height). Wrap in `FormControl` so the
label/error/aria wiring works.

```jsx
<FormField
  control={form.control}
  name="roleName"
  render={({ field }) => (
    <FormItem className="mb-5">
      <FormLabel>Role name {req}</FormLabel>
      {/* icon-prefix pattern: the relative wrapper is OUTSIDE FormControl, so the id/aria
          land on the <input>, not the wrapper div. */}
      <div className="relative">
        <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--color-text-muted)" }} />
        <FormControl>
          <Input placeholder="e.g., Branch Manager" className="h-10 pl-9" {...field} />
        </FormControl>
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```

- **Textarea + counter** (`showCount` replacement): render a manual `{value.length}/max` beside
  `<FormMessage/>`.
- **Disable identifier fields** (email/username/slug) in edit mode: `disabled={isEditMode}`.
- **Password fields** use the shared `PasswordInput` (`@/…/components/PasswordInput`) — input +
  show/hide toggle. For strength UI, `form.watch("password")` → `<PasswordStrengthIndicator />`,
  and validate with `zStrongPassword(8)` from `utils/validation`.

### 3a. Phone fields — shared helpers, never a hand-rolled placeholder

Every phone is a PH mobile stored as `09XX XXXX XXX` (grouped 4-4-3). The hint is always the
concrete example `0912 3456 789`. All pieces come from `src/utils/phoneFormat.js`:

```jsx
import { PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, formatPhoneOnChange, zPhone } from "…/utils/phoneFormat";

// schema:  phone: zPhone,
<FormField control={form.control} name="phone" render={({ field }) => (
  <FormItem>
    <FormLabel>Phone number</FormLabel>
    <div className="relative">
      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: "var(--color-text-muted)" }} />
      <FormControl>
        <Input
          placeholder={PHONE_PLACEHOLDER}
          className="h-10 pl-9"
          maxLength={PHONE_MAX_LENGTH}
          {...field}
          onChange={(e) => field.onChange(formatPhoneOnChange(e.target.value))}
        />
      </FormControl>
    </div>
    <FormMessage />
  </FormItem>
)} />
```

`zPhone` passes on empty (phone is optional) and only checks the shape once typed;
`formatPhoneOnChange` types the spaces in as the user goes. Display stored values with
`formatPhoneDisplay()`.

### 3b. Select fields

```jsx
<FormField control={form.control} name="roleId" render={({ field }) => (
  <FormItem>
    <FormLabel>Role {req}</FormLabel>
    <Select value={field.value || undefined} onValueChange={field.onChange}>
      <FormControl>
        <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select role" /></SelectTrigger>
      </FormControl>
      <SelectContent>
        {roles.map((r) => <SelectItem key={r.roleId} value={r.roleId}>{r.roleName}</SelectItem>)}
      </SelectContent>
    </Select>
    <FormMessage />
  </FormItem>
)} />
```

`SelectItem` values can't be empty strings (Radix throws). For an "All" filter option use a
sentinel like `"all"` and map it to `""`. shadcn `Select` has **no type-ahead search**; if a list
is long enough to need one, build a combobox from `popover` + `command` (both already installed).

### 4. `StatusToggle` for on/off choices — not a Select

`StatusToggle` (`@/…/components/StatusToggle`) is controlled, so bind it to the field directly
(no `FormControl` needed — it's a custom control, not a native input):

```jsx
<FormField control={form.control} name="status" render={({ field }) => (
  <FormItem>
    <FormLabel>Status {req}</FormLabel>
    <StatusToggle value={field.value} onChange={field.onChange} />
    <FormMessage />
  </FormItem>
)} />
```

Pass `options` for non-status pairs: `[{ v: "On", dot: "var(--color-success)" }, …]`.

### 5. Footer — hairline top border; Cancel + inverted primary

The footer lives **inside** the `<form>`, so the primary button is `type="submit"`.

```jsx
<div
  className="flex justify-end gap-3 p-6 pt-5"
  style={{ borderTop: "1px solid var(--color-line)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
>
  <Button type="button" variant="outline" size="lg" onClick={handleClose}>Cancel</Button>
  <Tooltip>
    <TooltipTrigger asChild>
      {/* span keeps the tooltip working while the button is disabled */}
      <span className="inline-flex">
        <Button type="submit" size="lg" disabled={saveDisabled || isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {isEditMode ? "Update Role" : "Create Role"}
        </Button>
      </span>
    </TooltipTrigger>
    {saveDisabled && <TooltipContent>No changes to save yet</TooltipContent>}
  </Tooltip>
</div>
```

The default `<Button>` variant **is** the inverted monochrome primary — never add an inline
`background`. `variant="outline"` is the secondary (Cancel). React Query v5 mutations expose
**`isPending`**, not `isLoading`.

---

## Behaviour

### Edit mode & hydration

```jsx
const isEditMode = !!entity;

useEffect(() => {
  if (!open) return;
  form.reset(
    entity
      ? { roleName: entity.roleName ?? "", description: entity.description ?? "", status: entity.status ?? "Active" }
      : EMPTY,
  );
}, [open, entity, form]);
```

Map fields **explicitly** — never `form.reset(entity)` (API responses carry extra keys).
`form.reset(values)` sets the baseline that the dirty check diffs against.

### Dirty check — built in

```jsx
const { formState: { isDirty } } = form;
const saveDisabled = isEditMode && !isDirty;   // create mode: always enabled, validation gates it
```

RHF's `isDirty` replaces the old `Form.useWatch` + `isFormEqual` snapshot machinery — delete it.
When a form also stages a file (image upload), combine: `const dirty = isDirty || !!logoFile`.

### Submit

`form.handleSubmit(onSubmit)` runs validation first and **focuses the first invalid field itself**
(no more `focusFirstError`). `onSubmit` only receives valid, typed values:

```jsx
const onSubmit = async (values) => {
  try {
    if (isEditMode) await updateMutation.mutateAsync({ roleId: entity.roleId, data: values });
    else await createMutation.mutateAsync(values);
    onSuccess?.();               // mutation onError already shows a toast
  } catch (error) {
    console.error("Form submission error:", error);
  }
};
```

Map the payload explicitly to the backend (no `...values` spread of unknown keys); write optional
empty fields as `value || null` where the API expects null.

### Internal close

```jsx
const handleClose = () => { form.reset(EMPTY); onClose(); };
```

Cancel and the bordered X both call `handleClose`. The Sheet's `onOpenChange(false)` (Esc /
overlay click) also routes to it.

### Conditional sections

Wrap create-only groups in `{!isEditMode && (…)}` with the `SectionLabel` inside the conditional.
Build the schema with `useMemo` so create-only fields (e.g. `password`) are only validated in
create mode:

```jsx
const schema = useMemo(
  () => z.object(isEditMode ? baseShape : { ...baseShape, password: zStrongPassword(8) }),
  [isEditMode],
);
```

---

## Variations

- **Dialog instead of Sheet** — for very short forms (1–2 sections) swap `<Sheet>`/`<SheetContent>`
  for `<Dialog>`/`<DialogContent className="sm:max-w-[520px]">`; component becomes `XFormModal`.
- **Wide/dense sheets** go wider — the user-permissions matrix uses `sm:max-w-[1000px]`.
- **Read-only detail modals** use `<Dialog>` + `DescriptionList` at `sm:max-w-[640px]` — see
  `UserViewModal.jsx`.

---

## Image upload

For image upload, use a hidden `<input type="file">` triggered by a `<Button type="button">`,
keep `validateImageFile` + `getImageUrl` (`utils/upload.js`) and `deleteFileApi`
(`services/api/upload.js`), preview via `FileReader`, and upload on submit via `FormData` through
the `"multipart"` axios instance. Include the staged file in the dirty check
(`isDirty || !!logoFile`). See `CompanyFormDrawer.jsx`.

---

## Checklist

- [ ] Component named `XFormDrawer`; imports `Sheet` itself; parent renders it with the props contract
- [ ] Props exactly `{ open, onClose, onSuccess, entity? }` — no `onCancel`
- [ ] `<SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-[800px]">` + `sr-only` `<SheetTitle>`
- [ ] `useForm({ resolver: zodResolver(schema), defaultValues })`; concrete defaults; `form.reset()` to hydrate
- [ ] One zod schema; optional fields validate shape-not-presence; required-ness matches the backend (checked `schema.sql`/controller)
- [ ] Required fields render an explicit `*` (shadcn doesn't add one)
- [ ] Header: accent chip + title + subtitle + bordered X; copy switches on `isEditMode`
- [ ] `SectionLabel` per group; `<FormField>`/`<FormItem>`/`<FormLabel>`/`<FormControl>`/`<FormMessage>` per field
- [ ] `h-10` inputs; icon prefix via relative wrapper outside `FormControl`; phone via `phoneFormat` helpers; password via `PasswordInput`
- [ ] `StatusToggle` for on/off choices (not a Select)
- [ ] Footer inside the `<form>`: Cancel (`variant="outline"`) + inverted primary (`type="submit"`, default variant, `+` icon), no inline `background`
- [ ] Dirty check via `formState.isDirty`; edit-mode disable + tooltip (span wrapper)
- [ ] `loading` bound to `createMutation.isPending || updateMutation.isPending`
- [ ] Payload mapped explicitly; empty optionals → `null` where the API expects it
- [ ] No hardcoded hex; no shadow/gradient except the header chip
