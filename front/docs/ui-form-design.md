# UI Form Design — "Modern" Drawer Pattern

When building or editing any create/edit form, follow this pattern.

> Reference implementation: **`src/pages/Admin/UserManagement/Roles/components/RoleFormDrawer.jsx`**.
> Canonical spec: **`modern-module-pattern.md`** §5.

---

## When to use

Apply for drawer-based create/edit forms in admin modules. Skip for inline edits, single-field
filters, wizards (use Ant `Steps`), and read-only detail views.

---

## The architectural rule (NON-NEGOTIABLE)

**The form file owns the Drawer. The parent is dumb.**

**Form file** (`XFormDrawer.jsx`):

- Imports `Drawer` from `antd`; the component name ends in `FormDrawer`.
- Props are exactly `{ open, onClose, onSuccess, entity? }` — in that order. No `onCancel`,
  no `visible`, no `isEditMode` from outside. `entity` presence flips edit mode internally.
- Renders `<Drawer open={open} onClose={handleClose} width={800} closable={false} styles={{ body: { padding: 24 } }}>`
  as its root.

**Parent**: holds `open` state and renders
`<XFormDrawer open={...} onClose={...} onSuccess={...} entity={...} />`. It **never** wraps the
form in its own Drawer.

**If you find a presentational form** (no Drawer import, props like `{ entity, onSuccess, onCancel }`),
**convert it**: add the Drawer, rename to `XFormDrawer`, switch to the props contract, add a
`handleClose` that resets the form then calls `onClose`, and update the parent.

---

## Anatomy

### 1. Header — accent chip + title + subtitle + bordered X

`closable={false}`; we render our own X (this is the one place a gradient is allowed — the chip).

```jsx
<div className="flex items-start justify-between gap-3 mb-7">
  <div className="flex items-center gap-3 min-w-0">
    <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
      <Shield className="w-[22px] h-[22px] text-white" />
    </span>
    <div className="min-w-0">
      <h2
        className="m-0 font-semibold leading-tight"
        style={{ fontSize: 19, color: "var(--color-text-dark)" }}
      >
        {isEditMode ? "Edit Role" : "Create New Role"}
      </h2>
      <p
        className="m-0 mt-0.5"
        style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
      >
        {isEditMode
          ? "Update role information"
          : "Define a new role for your company"}
      </p>
    </div>
  </div>
  <button
    onClick={handleClose}
    aria-label="Close"
    className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
    style={{
      width: 32,
      height: 32,
      borderRadius: 8,
      border: "1px solid var(--color-line)",
      color: "var(--color-text-secondary)",
    }}
  >
    <X className="w-[18px] h-[18px]" />
  </button>
</div>
```

### 2. Sections — `SectionLabel`, not `<Divider>`

```jsx
import SectionLabel from "../../../../../components/SectionLabel";

<div>
  <SectionLabel>Role details</SectionLabel>
  {/* fields */}
</div>
<div className="mt-7">
  <SectionLabel>Access status</SectionLabel>
  {/* fields */}
</div>
```

### 3. Fields

Ant `Form` `layout="vertical"` `requiredMark`; `size="large"` on inputs; a lucide icon `prefix`
where it clarifies; `showCount maxLength` on textareas. Concrete placeholders
(`"e.g., Branch Manager"`). Rely on `rules` for validation messages. Disable identifier fields
(email/username/slug) in edit mode.

### 3a. Required-ness must match the backend

**A field is required in the form only if the backend actually requires it** — i.e. the DB column is
`NOT NULL` or the API rejects it when missing. Check `back/database/schema.sql` and the controller
before marking anything required; don't guess.

Known-optional fields — **never mark these required**:

| Field | Why |
| ----- | --- |
| `description` | every `description` column is `TEXT NULL`; the API writes `description \|\| null` |
| `phone` | every `phone` column is `VARCHAR(20) NULL`; the API writes `phone \|\| null` |

Validate **shape, not presence**, on optional fields — the rule only fires once the user types:

```jsx
// ✅ optional, but must be sane when provided
<Form.Item label="Description" name="description"
  rules={[{ min: 10, message: "Description must be at least 10 characters" }]}>
  <TextArea rows={4} showCount maxLength={500} />
</Form.Item>
```

(async-validator skips `min`/`max`/`pattern`/`type` on an empty value when the rule isn't
`required`, so an untouched optional field passes.)

### 3c. Phone fields use the shared helpers — never a hand-rolled placeholder

Every phone in the app is a PH mobile stored as **`09XX XXXX XXX`** (11 digits, grouped 4-4-3).
The hint the user sees is always the concrete example **`0912 3456 789`** — never the `09XX…`
mask. All four pieces come from `src/utils/phoneFormat.js`, so a phone field is always:

```jsx
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  handlePhoneInput,
  phoneValidator,
} from "../../../../utils/phoneFormat";

<Form.Item name="phone" label="Phone" rules={[{ validator: phoneValidator }]}>
  <Input
    prefix={<Phone className="w-4 h-4 mr-2" style={{ color: "var(--color-text-muted)" }} />}
    placeholder={PHONE_PLACEHOLDER}
    size="large"
    maxLength={PHONE_MAX_LENGTH}
    onChange={(e) => handlePhoneInput(e, form)}
  />
</Form.Item>;
```

- `handlePhoneInput` types the spaces in as the user goes, so the value is already canonical by
  the time it's submitted — no `onBlur` reformat needed.
- `PHONE_MAX_LENGTH` is 13 (11 digits + 2 spaces), so paste-in of a longer string is truncated.
- `phoneValidator` checks **shape only** and passes on empty — phone is optional everywhere
  (see the table above). If a form ever needs it mandatory, add a separate `{ required: true }`
  rule so Ant still draws the `*` (per §3b).
- **Displaying** a stored value (table cell, view modal) goes through `formatPhoneDisplay()` from
  the same module, so legacy rows written before the convention still render grouped.

The backend's `optionalPhone()` normalises whatever it receives to the same canonical form, so
the two sides can't drift.

### 3b. If a field IS required, declare it — or you get an error with no `*`

Ant only renders the required asterisk when a rule declares `required: true` (or the `Form.Item`
has the `required` prop). A **custom `validator` that rejects empty** produces a "required" error
next to a label with **no `*`** — which reads as a bug to users:

```jsx
// ❌ errors "Phone number is required" but shows no asterisk
rules={[{ validator: phoneValidator }]}

// ✅ required → Ant draws the `*`, the validator still does the checking
<Form.Item name="password" label="Temporary password" required
  rules={[validationRules.strongPassword(8)]}>
```

So: either the field is optional (loosen the validator), or it's required (declare it). Never a
custom validator quietly enforcing presence.

### 4. `StatusToggle` for on/off choices — not a Select

Controlled, so it drops straight into a `Form.Item`:

```jsx
import StatusToggle from "../../../../../components/StatusToggle";

<Form.Item
  name="status"
  label="Status"
  initialValue="Active"
  rules={[{ required: true, message: "Please select status" }]}
>
  <StatusToggle />
</Form.Item>;
```

Pass `options` for non-status pairs:
`[{ v: "On", dot: "var(--color-success)" }, { v: "Off", dot: "var(--color-text-muted)" }]`.

### 5. Footer — hairline top border; Cancel + inverted primary

```jsx
<div
  className="mt-8 pt-5 flex justify-end gap-3"
  style={{
    borderTop: "1px solid var(--color-line)",
    paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
  }}
>
  <Button onClick={handleClose} size="large">
    Cancel
  </Button>
  <Tooltip title={saveDisabled ? "No changes to save yet" : undefined}>
    <span>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleSubmit}
        disabled={saveDisabled}
        loading={createMutation.isPending || updateMutation.isPending}
        size="large"
      >
        {isEditMode ? "Update Role" : "Create Role"}
      </Button>
    </span>
  </Tooltip>
</div>
```

**Never** put an inline `background` on the primary button — the inverted style is global. The
`paddingBottom` gives the buttons iOS home-indicator clearance (needs `viewport-fit=cover` in the
viewport meta; it safely resolves to 24px elsewhere). The `<span>` wrapper keeps the Tooltip
working while the button is disabled (a disabled button has `pointer-events: none`).

---

## Behaviour

### Edit mode & hydration

```jsx
const isEditMode = !!entity;

useEffect(() => {
  if (!open) return;
  if (entity) {
    const values = {
      roleName: entity.roleName,
      description: entity.description,
      status: entity.status,
    };
    form.setFieldsValue(values);
    initialValuesRef.current = values; // baseline for the dirty check
  } else {
    form.resetFields();
    const defaults = { status: "Active" };
    form.setFieldsValue(defaults);
    initialValuesRef.current = defaults;
  }
}, [open, entity, form]);
```

Map fields **explicitly** — never `form.setFieldsValue(entity)` (API responses carry extra keys).

### Internal close

```jsx
const handleClose = () => {
  form.resetFields();
  onClose();
};
```

Cancel calls `handleClose` — never an `onCancel` prop.

### Dirty check — disable save until something actually changed

In **edit** mode disable the primary until dirty **and** guard the handler; in **create** mode
leave it enabled (validation gates an empty form). Don't gate on `form.isFieldsTouched()` — it
stays true after a value is changed back. Diff against the snapshot:

```jsx
const watchedValues = Form.useWatch([], form);
const isDirty = useMemo(
  () =>
    !isFormEqual(
      watchedValues ?? form.getFieldsValue(),
      initialValuesRef.current,
    ),
  [watchedValues, form],
);
const saveDisabled = isEditMode && !isDirty;
```

### Submit

```jsx
const handleSubmit = async () => {
  if (isEditMode && !isDirty) {
    message.info("No changes to save");
    return;
  }
  try {
    const values = await form.validateFields();
    if (isEditMode)
      await updateMutation.mutateAsync({ roleId: entity.roleId, data: values });
    else await createMutation.mutateAsync(values);
    form.resetFields();
    onSuccess?.();
  } catch (error) {
    if (error?.errorFields?.length) return focusFirstError(form, error);
    console.error("Form submission error:", error);
  }
};
```

`message` comes from `App.useApp()` (the project uses `@ant-design/v5-patch-for-react-19` — don't
use the static `message` import). React Query v5: mutations expose **`isPending`**, not
`isLoading`.

### Focus the first error

Because we submit imperatively, `<Form scrollToFirstError>` never fires — handle it:

```jsx
const focusFirstError = (form, error) => {
  const first = error?.errorFields?.[0]?.name;
  if (first)
    form.scrollToField(first, {
      behavior: "smooth",
      block: "center",
      focus: true,
    });
};
```

### Conditional sections

Wrap create-only groups in `{!isEditMode && (...)}` — the `SectionLabel` goes inside the
conditional so nothing dangles.

---

## Variations

- **Modal instead of Drawer** — for very short forms (1–2 sections, <5 fields) swap `<Drawer>` for
  `<Modal width={520} footer={null}>`; component becomes `XFormModal`. Everything else identical.
- **Wide/dense drawers** may go wider than 800 — the user-permissions matrix uses `width={1000}`.
- **View/detail modals** use `width={640}`.

---

## Image upload

Keep the existing flow: `validateImageFile` + `getImageUrl` (`utils/upload.js`), `deleteFileApi`
(`services/api/upload.js`), `beforeUpload={() => false}` + `showUploadList={false}` with your own
preview, upload on submit via `FormData` through the `"multipart"` axios instance, and include the
staged file in the dirty check (`valuesChanged || !!imageFile`). Style the preview/placeholder with
tokens (`--color-surface-sunken`, `--color-line`) — no pastel or dashed-blue boxes.

---

## Checklist

- [ ] Component named `XFormDrawer` and it imports `Drawer` itself
- [ ] Props exactly `{ open, onClose, onSuccess, entity? }` — no `onCancel`
- [ ] `<Drawer width={800} closable={false} styles={{ body: { padding: 24 } }}>`
- [ ] Header: accent chip + title + subtitle + bordered X; copy switches on `isEditMode`
- [ ] `SectionLabel` per group (no `<Divider>`, no dangling label in a conditional)
- [ ] `size="large"` inputs; `showCount maxLength` on textareas; explicit placeholders
- [ ] Required-ness matches the backend (checked `schema.sql`/controller) — `description` and `phone` are **optional**
- [ ] Every required field declares `required` so Ant draws the `*` — no custom validator silently enforcing presence
- [ ] `StatusToggle` for on/off choices (not a Select)
- [ ] Footer: Cancel + inverted primary (`+` icon), no inline `background`
- [ ] Dirty check via snapshot diff; edit-mode disable + tooltip; `handleSubmit` guards `!isDirty`
- [ ] `loading` bound to `createMutation.isPending || updateMutation.isPending`
- [ ] Failed validation focuses the first invalid field
- [ ] Payload mapped explicitly (no `...values` spread to the backend); dates via `dayjs`
- [ ] No hardcoded hex; no shadow/gradient (except the header chip); no pastel
