# UI Form Design — Gradient Drawer Pattern

When building or editing any create/edit form, follow the Gradient Drawer Form pattern.

---

A polished, sectioned form pattern for admin/CRUD interfaces. **The form component always owns its own `<Drawer>`.** The parent does nothing more than render `<XFormDrawer open={...} onClose={...} onSuccess={...} />`.

## When to use

Apply this pattern for:

- Drawer-based create/edit forms in admin dashboards
- Multi-section forms (basic info, contact, schedule, etc.)
- Entity forms that benefit from clear visual sectioning (2+ logical groups of fields)
- CRUD interfaces where the form is a primary surface

Skip this pattern for:

- Inline edit forms (use plain Ant Form)
- Single-field inputs or quick filters
- Wizard/stepper flows (use Ant Steps)
- Read-only detail views

## Tech stack assumed

- React 18+ with hooks
- Ant Design v5 (`antd`)
- Tailwind CSS v4 (uses `bg-linear-to-*`, **not** `bg-gradient-to-*`)
- `lucide-react` for iconography
- `@tanstack/react-query` for mutations (via custom hooks like `useCreateX` / `useUpdateX`)
- `dayjs` for date formatting

If the project uses different equivalents, keep the structure and swap only the dependencies.

---

## The architectural rule (NON-NEGOTIABLE)

The form file owns the Drawer. The parent is dumb.

**Form file** (`XFormDrawer.jsx`):

- Imports `Drawer` from `antd`
- Component name ends in `FormDrawer` (or `FormModal` if a Modal is more appropriate)
- Accepts exactly these props: `{ open, onClose, onSuccess, entity? }`
- Renders `<Drawer>` as its root element

**Parent file:**

- Holds `useState` for `open`
- Renders `<XFormDrawer open={isOpen} onClose={() => setIsOpen(false)} onSuccess={handleSuccess} />`
- **Never** wraps the form in its own Drawer
- **Never** passes `onCancel` (the form has its own internal close handler)

### If you see a presentational form, CONVERT IT

If the existing file is a presentational form (no Drawer import, props are `{ entity, onSuccess, onCancel }`, component name like `UserForm` rather than `UserFormDrawer`), it is **not** the target pattern — it's a legacy shape to be migrated. Convert it:

1. Add `Drawer` to the `antd` imports
2. Rename the component (and file) from `XForm` → `XFormDrawer`
3. Change props from `{ entity, onSuccess, onCancel }` to `{ open, onClose, onSuccess, entity? }`
4. Wrap the entire return in `<Drawer open={open} onClose={handleClose} width={"45vw"} closable={false} styles={{ body: { padding: 0 } }}>...</Drawer>`
5. Add a `handleClose` function that resets the form and calls `onClose`
6. Change the footer Cancel button's handler from `onCancel` to `handleClose`
7. Update the parent: remove its Drawer wrapper, change props passed from `{onCancel}` to `{open, onClose}`

---

## Design Tokens

Reuse these everywhere. Do not invent new shades.

### Colors

| Purpose              | Token                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| Primary gradient     | `from-blue-500 to-indigo-500` (icon boxes, accent bars)                                |
| Title text gradient  | `from-blue-600 to-indigo-600`                                                          |
| Page background      | `bg-linear-to-br from-slate-50 via-white to-slate-50`                                  |
| Body text            | `text-slate-900` (headings), `text-slate-700` (body), `text-slate-500` (subtitle/help) |
| Helper text          | `text-xs text-slate-500 mt-3`                                                          |
| Icon (in input)      | `text-slate-400`                                                                       |
| Borders              | `border-slate-200`                                                                     |
| Hover bg (subtle)    | `hover:bg-slate-50`                                                                    |
| Status dot: active   | `bg-green-500`                                                                         |
| Status dot: inactive | `bg-slate-300`                                                                         |
| Status dot: warning  | `bg-amber-500`                                                                         |
| Primary button bg    | `linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)` (inline `style`)                   |

### Sizing & Radius

| Element            | Value                                             |
| ------------------ | ------------------------------------------------- |
| Input height       | `h-11` (44px) + Ant `size="large"`                |
| Input radius       | `rounded-xl`                                      |
| Icon box radius    | `rounded-xl`                                      |
| Button height      | `h-11` + `size="large"`                           |
| Drawer width       | `600` (default; bump to `720` for dense forms)    |
| Section accent bar | `w-1 h-5 rounded-full`                            |
| Header icon box    | `p-2.5`                                           |
| Lucide icons       | `w-4 h-4` (in inputs/options), `w-6 h-6` (header) |
| Status dot         | `w-2 h-2 rounded-full`                            |

### Spacing rhythm

- `p-6` inside the Drawer body
- `mb-8` between sections
- `mb-4` below section headings
- `mt-8 pt-6` for footer separator
- Footer `paddingBottom: calc(1.5rem + env(safe-area-inset-bottom))` — iOS home-indicator clearance (never let the buttons sit flush)
- `gap-3` between footer buttons
- `gap-4` in field grids

---

## Anatomy

### 1. Drawer wrapper (always present)

```jsx
<Drawer
  open={open}
  onClose={handleClose}
  width={400}
  closable={false}
  styles={{ body: { padding: 0 } }}
>
  <div className="h-full bg-linear-to-br from-slate-50 via-white to-slate-50 flex flex-col p-6 overflow-y-auto">
    {/* header → form → footer */}
  </div>
</Drawer>
```

Key choices:

- `closable={false}` — the Cancel button in the footer is the close affordance. No top-right X.
- `styles={{ body: { padding: 0 } }}` — we control padding ourselves to apply the gradient background edge-to-edge.
- Outer `div` is `h-full flex flex-col overflow-y-auto` — the form scrolls, the footer flows with it (not sticky).

### 2. Header

```jsx
<div className="mb-8">
  <div className="flex items-center gap-3 mb-2">
    <div className="p-2.5 bg-linear-to-br from-blue-500 to-indigo-500 rounded-xl">
      <Users className="w-6 h-6 text-white" />
    </div>
    <h2 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
      {isEditMode ? "Edit User" : "Create New User"}
    </h2>
  </div>
  <p className="text-sm text-slate-500 ml-11">
    {isEditMode ? "Update existing record" : "Add a new record"}
  </p>
</div>
```

Pick a Lucide icon based on the entity (`Users`/`User`, `Package`, `Calendar`, `FileText`, `Building2`, `Briefcase`, etc.). Always white on the gradient. The subtitle's `ml-11` aligns it with the title text.

### 3. Section heading

```jsx
<h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
  <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-indigo-500 rounded-full"></span>
  Section Name
</h3>
```

The vertical gradient bar is the visual signature — keep it on every section. Wrap each section in `<div className="mb-8">` and separate with `<Divider className="my-6" />`.

### 4. Form-level config

Always: `<Form form={form} layout="vertical" requiredMark={true} className="flex-1 space-y-1">`

### 5. Field templates

**Text input with icon prefix:**

```jsx
<Form.Item
  label="Email"
  name="email"
  rules={[{ required: true, type: "email" }]}
>
  <Input
    placeholder="juan@example.com"
    className="rounded-xl text-sm"
    prefix={<Mail className="w-4 h-4 text-slate-400 mr-2" />}
    size="large"
  />
</Form.Item>
```

**Text input without icon** (when icon would clutter — first/last name, etc.):

```jsx
<Input placeholder="Juan" className="rounded-xl text-sm" size="large" />
```

**Disabled-in-edit-mode field** (typical for unique identifiers like email or username):

```jsx
<Input ... disabled={isEditMode} />
```

**TextArea:**

```jsx
<TextArea rows={3} placeholder="..." className="rounded-xl text-sm" />
```

**DatePicker:**

```jsx
<DatePicker className="w-full rounded-xl" placeholder="..." size="large" />
```

**InputNumber** (the `w-full` is required):

```jsx
<InputNumber className="w-full rounded-xl" size="large" />
```

**Select (basic):**

```jsx
<Select placeholder="Select..." className="rounded-xl text-sm" size="large">
  <Option value="A">A</Option>
</Select>
```

**Select with icon-prefixed options:**

```jsx
<Option value="Doctor">
  <span className="flex items-center gap-2">
    <Briefcase className="w-4 h-4" />
    Doctor
  </span>
</Option>
```

**Select with status dots** (for any status-like field):

```jsx
<Option value="Active">
  <span className="flex items-center gap-2">
    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
    Active
  </span>
</Option>
```

**Searchable Select** (when options >5 or dynamic):

```jsx
<Select showSearch optionFilterProp="children" ...>
  {items.map(item => <Option key={item.id} value={item.id}>...</Option>)}
</Select>
```

**Password with show/hide toggle:**

```jsx
const [showPassword, setShowPassword] = useState(false);

<Input
  type={showPassword ? "text" : "password"}
  placeholder="Enter password"
  className="h-11 rounded-xl text-sm"
  prefix={<Lock className="w-4 h-4 text-slate-400 mr-2" />}
  suffix={
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="text-slate-400 hover:text-slate-600 transition-colors"
    >
      {showPassword ? (
        <EyeOff className="w-4 h-4" />
      ) : (
        <Eye className="w-4 h-4" />
      )}
    </button>
  }
  size="large"
/>;
```

**Two fields side-by-side (max 2 columns per row — never use 3+ column grids):**

```jsx
<div className="grid grid-cols-2 gap-4">
  <Form.Item ...>...</Form.Item>
  <Form.Item ...>...</Form.Item>
</div>
```

**Helper text under a field or section:**

```jsx
<p className="text-xs text-slate-500 mt-3">
  Helpful note about what this field does or what happens next.
</p>
```

### 6. Footer

```jsx
const saveDisabled = isEditMode && !isDirty;

// `paddingBottom` adds the iOS safe-area inset (home-indicator gap) on top of
// the normal 24px, so the buttons are never flush with / clipped by the screen
// edge on mobile. Falls back to 24px where the inset is unsupported.
<div
  className="mt-8 pt-6 border-t border-slate-200 flex justify-end gap-3"
  style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
>
  <Button
    onClick={handleClose}
    className="h-11 px-6 rounded-xl font-medium text-slate-700 border-slate-200 hover:bg-slate-50"
    size="large"
  >
    Cancel
  </Button>
  {/* span wrapper so the Tooltip still shows while the button is disabled
      (a disabled button has pointer-events: none and won't trigger it). */}
  <Tooltip title={saveDisabled ? "No changes to save yet" : undefined}>
    <span>
      <Button
        type="primary"
        onClick={handleSubmit}
        disabled={saveDisabled}
        loading={createMutation.isPending || updateMutation.isPending}
        className="h-11 px-8 rounded-xl font-medium border-none text-white"
        // Drop the gradient when disabled so Ant's greyed-out state shows
        // (an inline background would otherwise keep it looking active).
        style={
          saveDisabled
            ? undefined
            : {
                background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              }
        }
        size="large"
      >
        {isEditMode ? "Update Entity" : "Create Entity"}
      </Button>
    </span>
  </Tooltip>
</div>;
```

The Cancel button calls `handleClose` (the internal close handler), **not** an `onCancel` prop. The primary button's gradient is set via inline `style` because Ant's `type="primary"` overrides Tailwind background utilities; drop that inline `style` while `disabled` so Ant's greyed state is visible. `border-none` removes Ant's default primary border. Bind `loading` to whichever mutation(s) are in flight. In **edit** mode the button is disabled until the form is dirty (see "Only submit when there are changes"); in **create** mode it's always enabled.

The footer's `paddingBottom: calc(1.5rem + env(safe-area-inset-bottom))` is **required** — without it the buttons sit flush against the bottom edge and get clipped by the home indicator on iOS. This depends on `viewport-fit=cover` in the `index.html` viewport meta (`<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`); the `env()` resolves to `0` without it, so the rule still safely yields 24px on every platform.

---

## Behavioral patterns

### Props contract (memorize this)

```jsx
function XFormDrawer({ open, onClose, onSuccess, entity = null }) { ... }
```

That's it. Four props, in that order. No `onCancel`, no `visible`, no `isEditMode` from outside. The `entity` prop is optional — its presence flips the form into edit mode internally.

### Internal close handler

```jsx
const handleClose = () => {
  form.resetFields();
  onClose();
};
```

Always reset on close so reopening is clean. This is what the Cancel button calls.

### Edit-mode toggle

```jsx
const isEditMode = !!entity;
const createMutation = useCreateEntity();
const updateMutation = useUpdateEntity();
```

Use `isEditMode` to:

- Switch header copy (`"Edit X"` vs `"Create New X"`)
- Switch button label (`"Update X"` vs `"Create X"`)
- Disable identifier fields (`disabled={isEditMode}` on email/username)
- Hide create-only sections (e.g. password — see "Conditional sections")

### Hydrating fields on edit

```jsx
useEffect(() => {
  if (entity) {
    form.setFieldsValue({
      firstName: entity.firstName,
      // ...explicit fields, not spread, so we control what gets set
    });
  } else {
    form.resetFields();
    form.setFieldsValue({ status: "Active" }); // sensible defaults for create
  }
}, [entity, form]);
```

Why explicit and not `form.setFieldsValue(entity)`: backend responses often include extra fields (`createdAt`, `updatedBy`, etc.) that aren't in the form. Explicit assignment keeps the form clean.

### Conditional sections

Wrap create-only or edit-only sections in `{!isEditMode && (...)}`. **Always include the `<Divider />` inside the conditional** so it doesn't leave a dangling divider:

```jsx
{
  !isEditMode && (
    <>
      <Divider className="my-6" />
      <div className="mb-8">
        <h3>...Security...</h3>
        <Form.Item name="password">...</Form.Item>
      </div>
    </>
  );
}
```

### Submit handler

```jsx
const handleSubmit = async () => {
  // Edit mode: don't fire a no-op update. Belt-and-suspenders with the disabled
  // button — this also covers Enter-to-submit and quick double-clicks.
  if (isEditMode && !isDirty) {
    message.info("No changes to save");
    return;
  }

  try {
    const values = await form.validateFields();

    const payload = {
      firstName: values.firstName,
      // ...explicit field mapping; format dates here:
      // someDate: values.someDate ? dayjs(values.someDate).format("YYYY-MM-DD") : null,
    };

    if (isEditMode) {
      await updateMutation.mutateAsync({
        entityId: entity.entityId,
        data: payload,
      });
    } else {
      await createMutation.mutateAsync({
        ...payload,
        password: values.password,
      });
    }

    form.resetFields();
    onSuccess?.(/* optionally pass id */);
  } catch (error) {
    // Validation failed → jump to AND focus the first invalid field.
    if (error?.errorFields?.length) {
      focusFirstError(form, error);
      return;
    }
    console.error("Form submission error:", error);
  }
};
```

`message` comes from `const { message } = App.useApp();` (Ant's context-aware API — the project uses `@ant-design/v5-patch-for-react-19`, so don't use the static `message` import).

### Focus + scroll to the first error field

On a failed submit, the user should never have to hunt for what's wrong — move the viewport and the cursor to the first invalid field.

This pattern submits **imperatively** (`form.validateFields()` from the footer button's `onClick`), so Ant's `<Form scrollToFirstError>` prop does **not** fire — that prop only triggers on native form submission (`htmlType="submit"` / `form.submit()`). Handle it yourself in the `catch`:

```jsx
// helper — keep it next to the component (or in a shared forms util)
const focusFirstError = (form, error) => {
  const first = error?.errorFields?.[0]?.name;
  if (!first) return;
  // antd 5: `focus: true` both scrolls into view AND focuses the control.
  form.scrollToField(first, {
    behavior: "smooth",
    block: "center",
    focus: true,
  });
};
```

`scrollToField(name, { focus: true })` is verified for antd ≥5 (`ScrollFocusOptions = scroll-into-view options & { focus?: boolean }`). If a custom control doesn't accept focus, fall back to `form.focusField(first)` or `form.getFieldInstance(first)?.focus?.()`.

> If you ever convert a form to native submission (`<Form onFinish={handleSubmit}>` + `<Button htmlType="submit">`), drop the manual helper and just set `<Form scrollToFirstError={{ behavior: "smooth", block: "center", focus: true }}>`.

### Only submit when there are changes (dirty check)

**Recommendation (this is the default — do this):**

- **Edit mode** → **disable** the primary button until the form is _dirty_ (a value actually differs from what was loaded), **and** guard the handler (`if (isEditMode && !isDirty) return`). Disabling is the clearest at-a-glance signal ("nothing to save") and avoids pointless network calls; the handler guard is the safety net for Enter-to-submit and races.
- **Create mode** → keep the button **enabled**. There's no baseline to diff against; let `rules` validation gate an empty form.
- Add a short reason when disabled so it isn't mistaken for a broken button — a `Tooltip` (wrap the button in a `<span>`, because a disabled button has `pointer-events: none` and won't trigger the tooltip on its own).

Don't gate on `form.isFieldsTouched()` alone — "touched" stays true even after the user types something and changes it back, so they'd be allowed to "save" an unchanged record. Diff against a snapshot of the loaded values instead:

```jsx
import { Form } from "antd";
import { useEffect, useMemo, useRef } from "react";

// dependency-free value compare. dayjs serialises to ISO via toJSON (stable),
// and null/undefined/"" are treated as equal (Ant uses these interchangeably).
const isFormEqual = (a = {}, b = {}) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (JSON.stringify(a[k] ?? "") !== JSON.stringify(b[k] ?? "")) return false;
  }
  return true;
};

// ...inside the component:
const initialValuesRef = useRef({});

useEffect(() => {
  if (entity) {
    const values = {
      /* same explicit field mapping you pass to setFieldsValue */
    };
    form.setFieldsValue(values);
    initialValuesRef.current = values; // snapshot the baseline
  } else {
    form.resetFields();
    const defaults = { status: "Active" };
    form.setFieldsValue(defaults);
    initialValuesRef.current = defaults;
  }
}, [entity, form]);

// Form.useWatch re-renders on every change, keeping `isDirty` live.
const watchedValues = Form.useWatch([], form);
const isDirty = useMemo(
  // read from `watchedValues` (not just getFieldsValue) so the lint deps are honest
  () =>
    !isFormEqual(
      watchedValues ?? form.getFieldsValue(),
      initialValuesRef.current,
    ),
  [watchedValues, form],
);
```

> **Alternative (a11y-first):** keep the button always enabled, rely on the handler guard, and `message.info("No changes to save")` on a no-op submit. Choose this if your team would rather avoid disabled buttons entirely (no focus, no native tooltip). Pick one approach and apply it consistently across all forms.

---

## Parent usage (this is what the parent looks like)

```jsx
const [isFormVisible, setIsFormVisible] = useState(false);
const [selectedEntity, setSelectedEntity] = useState(null);

const handleCreate = () => {
  setSelectedEntity(null);
  setIsFormVisible(true);
};

const handleEdit = (entity) => {
  setSelectedEntity(entity);
  setIsFormVisible(true);
};

const handleSuccess = (id) => {
  setIsFormVisible(false);
  setSelectedEntity(null);
  // refetch list, show toast, etc.
};

return (
  <>
    <Button onClick={handleCreate}>New Entity</Button>
    <Table ... onRow={(record) => ({ onClick: () => handleEdit(record) })} />

    <EntityFormDrawer
      open={isFormVisible}
      onClose={() => setIsFormVisible(false)}
      onSuccess={handleSuccess}
      entity={selectedEntity}
    />
  </>
);
```

The parent never imports `Drawer`. The parent never wraps the form. The parent only manages `open` state and the optional `entity` for edit mode.

---

## Variations

### Color variants per entity domain

The blue→indigo gradient is the default. For domain differentiation, swap **all** of: icon-box gradient, accent-bar gradient, title text gradient, and primary button gradient — to a sibling pair:

| Domain                 | Gradient                                | Button hex          |
| ---------------------- | --------------------------------------- | ------------------- |
| Inventory / orders     | `from-blue-500 to-indigo-500` (default) | `#3b82f6 → #6366f1` |
| Money / finance        | `from-emerald-500 to-teal-500`          | `#10b981 → #14b8a6` |
| People / users         | `from-violet-500 to-purple-500`         | `#8b5cf6 → #a855f7` |
| Warnings / destructive | `from-orange-500 to-rose-500`           | `#f97316 → #f43f5e` |

Always keep both stops in the same hue family — never `from-blue-500 to-emerald-500`.

### Modal instead of Drawer

For shorter forms (1–2 sections, <5 fields), swap `<Drawer>` for `<Modal width={520} footer={null}>`. Component name becomes `XFormModal`. Everything else identical.

---

## Do / Don't

**Do**

- Always wrap the form in `<Drawer>` (or `<Modal>`) **inside the form file itself**. This is the architectural rule.
- Use props `{ open, onClose, onSuccess, entity? }` exactly. Do not invent variants.
- If you find a presentational form (no Drawer, takes `onCancel`), **convert it** — see "If you see a presentational form, CONVERT IT" above.
- Keep section count to 2–5. More than that suggests the entity should be split or stepped.
- Use Lucide icons exclusively. No mixing with Ant icons.
- Set `size="large"` on every Ant input, picker, select, and button.
- Provide concrete placeholder examples (`"juan@example.com"`, `"e.g., May 2026 Restock"`).
- Use `requiredMark={true}` and rely on `rules` validation messages.
- On failed validation, scroll to **and focus** the first invalid field (`focusFirstError`).
- In edit mode, gate the primary button on a real **dirty** check (snapshot diff, not `isFieldsTouched`) and guard `handleSubmit` too.
- Give the footer iOS home-indicator clearance: `paddingBottom: calc(1.5rem + env(safe-area-inset-bottom))` (with `viewport-fit=cover` in the viewport meta).
- Disable identifier fields (email, username, slug) in edit mode.
- Map form values to payload explicitly — never spread the whole `values` object.

**Don't**

- **Don't make the form presentational.** No `XForm` components that the parent wraps in a Drawer. Always `XFormDrawer` that owns its own Drawer.
- **Don't accept `onCancel` as a prop.** Cancel is internal — it calls `handleClose`, which resets the form and calls `onClose`.
- Don't use Ant's default primary blue (`#1677ff`). The gradient is the brand.
- Don't add a top-right close X to Drawers. The footer Cancel is the only close affordance (`closable={false}`).
- Don't make the footer sticky. Let it scroll with the content.
- Don't let the footer buttons sit flush with the bottom edge — add `paddingBottom: calc(1.5rem + env(safe-area-inset-bottom))` so they clear the iOS home indicator.
- Don't put `prefix` icons on `TextArea`, `DatePicker`, or `Select` — only on single-line `Input`. (Selects use icon-prefixed Options instead.)
- Don't use `bg-gradient-to-*` (Tailwind v3). Use `bg-linear-to-*` (Tailwind v4).
- Don't skip the section accent bar — it's the visual signature.
- Don't apply gradient to section headings. Only the main page title gets the gradient text treatment.
- Don't show success toasts inside the form. Let the parent handle that via `onSuccess`.
- Don't leave a dangling `<Divider />` outside a conditional section.
- Don't fire an update when nothing changed — guard `handleSubmit` with the dirty check (and disable the button in edit mode).
- Don't gate "dirty" on `form.isFieldsTouched()` alone — it stays true after a value is changed back to its original. Diff against the loaded snapshot.
- Don't leave the user stranded on a failed submit — always focus the first error field.
- Don't keep the inline gradient `style` on the primary button while it's `disabled` (it'd look active) — drop it so Ant greys it out.

---

## Complete skeleton

Drop-in starting point. Replace `Entity`, `Users` icon, sections, and fields.

```jsx
import {
  App,
  Button,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  Select,
  Tooltip,
} from "antd";
import { Users, Mail } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import {
  useCreateEntity,
  useUpdateEntity,
} from "../../../../../services/requests/admin/entity";
import dayjs from "dayjs";

const { TextArea } = Input;
const { Option } = Select;

// Dependency-free value compare for the dirty check. dayjs serialises to ISO via
// toJSON (stable); null/undefined/"" are treated as equal.
const isFormEqual = (a = {}, b = {}) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (JSON.stringify(a[k] ?? "") !== JSON.stringify(b[k] ?? "")) return false;
  }
  return true;
};

const focusFirstError = (form, error) => {
  const first = error?.errorFields?.[0]?.name;
  if (first)
    form.scrollToField(first, {
      behavior: "smooth",
      block: "center",
      focus: true,
    });
};

export default function EntityFormDrawer({
  open,
  onClose,
  onSuccess,
  entity = null,
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const isEditMode = !!entity;
  const createMutation = useCreateEntity();
  const updateMutation = useUpdateEntity();
  const initialValuesRef = useRef({});

  useEffect(() => {
    if (entity) {
      const values = {
        // explicit field mapping
      };
      form.setFieldsValue(values);
      initialValuesRef.current = values; // snapshot baseline for the dirty check
    } else {
      form.resetFields();
      const defaults = { status: "Active" };
      form.setFieldsValue(defaults);
      initialValuesRef.current = defaults;
    }
  }, [entity, form]);

  // Live dirty flag — re-renders on every value change.
  const watchedValues = Form.useWatch([], form);
  const isDirty = useMemo(
    () => !isFormEqual(form.getFieldsValue(), initialValuesRef.current),
    [watchedValues, form],
  );
  const saveDisabled = isEditMode && !isDirty;

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    if (isEditMode && !isDirty) {
      message.info("No changes to save");
      return;
    }
    try {
      const values = await form.validateFields();
      const payload = {
        /* explicit mapping; format dates here */
      };

      if (isEditMode) {
        await updateMutation.mutateAsync({
          entityId: entity.entityId,
          data: payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }

      form.resetFields();
      onSuccess?.();
    } catch (error) {
      if (error?.errorFields?.length) return focusFirstError(form, error);
      console.error("Form submission error:", error);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      width={"45vw"}
      closable={false}
      styles={{ body: { padding: 0 } }}
    >
      <div className="h-full bg-linear-to-br from-slate-50 via-white to-slate-50 flex flex-col p-6 overflow-y-auto">
        {/* HEADER */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-linear-to-br from-blue-500 to-indigo-500 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {isEditMode ? "Edit Entity" : "Create New Entity"}
            </h2>
          </div>
          <p className="text-sm text-slate-500 ml-11">
            {isEditMode ? "Update existing record" : "Add a new record"}
          </p>
        </div>

        <Form form={form} layout="vertical" className="flex-1 space-y-1">
          {/* SECTION 1 */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-indigo-500 rounded-full"></span>
              Section Name
            </h3>
            {/* fields */}
          </div>

          <Divider className="my-6" />

          {/* SECTION 2 — repeat */}
        </Form>

        {/* FOOTER — paddingBottom keeps the buttons clear of the iOS home indicator */}
        <div
          className="mt-8 pt-6 border-t border-slate-200 flex justify-end gap-3"
          style={{
            paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          }}
        >
          <Button
            onClick={handleClose}
            className="h-11 px-6 rounded-xl font-medium text-slate-700 border-slate-200 hover:bg-slate-50"
            size="large"
          >
            Cancel
          </Button>
          <Tooltip title={saveDisabled ? "No changes to save yet" : undefined}>
            <span>
              <Button
                type="primary"
                onClick={handleSubmit}
                disabled={saveDisabled}
                loading={createMutation.isPending || updateMutation.isPending}
                className="h-11 px-8 rounded-xl font-medium border-none text-white"
                style={
                  saveDisabled
                    ? undefined
                    : {
                        background:
                          "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                      }
                }
                size="large"
              >
                {isEditMode ? "Update Entity" : "Create Entity"}
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
    </Drawer>
  );
}
```

---

## Quick checklist before shipping

- [ ] Component is named `XFormDrawer` (or `XFormModal`)
- [ ] Component file imports `Drawer` from `antd`
- [ ] Props are exactly `{ open, onClose, onSuccess, entity? }` — no `onCancel`
- [ ] Drawer is correct width, `closable={false}`, body padding 0
- [ ] Internal `handleClose` resets form and calls `onClose`
- [ ] Cancel button calls `handleClose` (not an `onCancel` prop)
- [ ] Header has gradient icon box + gradient text title + slate-500 subtitle
- [ ] Header copy switches on `isEditMode`
- [ ] Every section has the vertical gradient accent bar
- [ ] Sections separated by `<Divider className="my-6" />` (no dangling dividers in conditionals)
- [ ] All inputs are `h-11 rounded-xl size="large"`
- [ ] Single-line `Input`s have a Lucide icon prefix where it adds clarity
- [ ] Select Options use icon-prefix or status-dot pattern when categorical
- [ ] Form uses `layout="vertical"` and `requiredMark={true}`
- [ ] Footer has Cancel + gradient primary
- [ ] Footer has `paddingBottom: calc(1.5rem + env(safe-area-inset-bottom))` (iOS home-indicator clearance) + `viewport-fit=cover` in viewport meta
- [ ] `loading` bound to `createMutation.isPending || updateMutation.isPending`
- [ ] Failed validation scrolls to + focuses the first invalid field (`focusFirstError`)
- [ ] Edit mode: primary button disabled until dirty (snapshot diff) + `handleSubmit` guards `!isDirty`
- [ ] Initial values snapshotted in `initialValuesRef` on hydrate; `Form.useWatch` keeps `isDirty` live
- [ ] Create mode: button stays enabled (validation gates an empty form)
- [ ] Edit mode: identifier fields disabled, `useEffect` hydrates `form.setFieldsValue`
- [ ] Submit handler maps fields explicitly (no `...values` spread to backend)
- [ ] Date fields normalized via dayjs before submit
- [ ] Parent code: no Drawer wrapper, only `<XFormDrawer open={...} onClose={...} onSuccess={...} entity={...} />`

---

## Image Upload Pattern

When a form needs an image/logo/avatar upload field, follow this pattern.

### Design

The upload section uses a **preview thumbnail + upload button** layout:

- Left: Square preview (or placeholder icon) with a hover-to-reveal delete button
- Right: Upload button + helper text

### Required imports

```jsx
import { CloudUploadOutlined, DeleteOutlined } from "@ant-design/icons";
import { Upload } from "antd";
import { getImageUrl, validateImageFile } from "../../../../utils/upload";
import { deleteFileApi } from "../../../../services/api/upload";
```

### State

```jsx
const [imagePreview, setImagePreview] = useState(null); // data URL or full URL for display
const [imageFile, setImageFile] = useState(null); // File object to upload on submit
const [oldImagePath, setOldImagePath] = useState(null); // existing server path (edit mode)
```

### Hydration (in the `useEffect`)

```jsx
// Edit mode — load existing image
setImagePreview(entity.logoUrl ? getImageUrl(entity.logoUrl) : null);
setOldImagePath(entity.logoUrl || null);
setImageFile(null);

// Create mode — reset
setImagePreview(null);
setImageFile(null);
setOldImagePath(null);
```

### Upload handler

```jsx
const MAX_FILE_MB = 2;

const handleImageChange = (info) => {
  const file = info.file.originFileObj || info.file;

  const validation = validateImageFile(file, {
    maxSizeMB: MAX_FILE_MB,
    allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  });

  if (!validation.valid) {
    message.error(validation.error);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => setImagePreview(e.target.result);
  reader.readAsDataURL(file);
  setImageFile(file);
};
```

### Remove handler

```jsx
const handleRemoveImage = async () => {
  if (oldImagePath && !oldImagePath.startsWith("data:")) {
    try {
      await deleteFileApi(oldImagePath); // pass "superadmin" as 2nd arg for SuperAdmin forms
    } catch {
      // best-effort; don't block UI
    }
  }
  setImagePreview(null);
  setImageFile(null);
  setOldImagePath(null);
};
```

### Template (JSX)

```jsx
<div className="mb-8">
  <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
    <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-indigo-500 rounded-full" />
    Logo
  </h3>

  <div className="flex items-start gap-4">
    {imagePreview ? (
      <div className="relative group">
        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50">
          <img
            src={imagePreview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={handleRemoveImage}
          className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer"
        >
          <DeleteOutlined className="text-xs" />
        </button>
      </div>
    ) : (
      <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
        <EntityIcon className="w-8 h-8 text-slate-400" />
      </div>
    )}

    <div className="flex-1">
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={() => false}
        onChange={handleImageChange}
      >
        <Button
          icon={<CloudUploadOutlined />}
          className="rounded-xl font-medium"
          size="large"
        >
          {imagePreview ? "Change Image" : "Upload Image"}
        </Button>
      </Upload>
      <p className="text-xs text-slate-500 mt-2">
        Recommended: Square image, max {MAX_FILE_MB}MB
        <br />
        Supported: JPG, PNG, GIF, WebP
      </p>
    </div>
  </div>
</div>
```

### Submit — handling file upload

Use `FormData` when an image file is staged, otherwise send JSON:

```jsx
if (imageFile) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  formData.append("logo", imageFile);
  await createMutation.mutateAsync(formData);
} else {
  await createMutation.mutateAsync(payload);
}
```

### API service — use the multipart instance

```jsx
import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);
const apiMultipart = createAxiosInstanceWithInterceptor(
  "multipart",
  userTypeAuth.admin,
);

export const createEntityApi = async (data) => {
  const isFormData = data instanceof FormData;
  const instance = isFormData ? apiMultipart : api;
  const response = await instance.post("/api/v1/admin/entities", data);
  return response.data;
};
```

### Dirty check — include image changes

```jsx
const isDirty = useMemo(() => {
  const valuesChanged = !isFormEqual(
    watchedValues ?? form.getFieldsValue(),
    initialValuesRef.current,
  );
  return valuesChanged || !!imageFile; // image staged = dirty
}, [watchedValues, imageFile, form]);
```

### Rules

1. Always validate file type and size before previewing (`validateImageFile`)
2. Use `beforeUpload={() => false}` — never auto-upload; handle it in `handleSubmit`
3. Use `showUploadList={false}` — we render our own preview
4. Delete button appears on hover only (`opacity-0 group-hover:opacity-100`)
5. On edit, try to delete the old file on the server before uploading a new one
6. Include `imageFile` in the dirty check so the save button enables when an image is staged
7. Use `createAxiosInstanceWithInterceptor("multipart", ...)` for FormData submissions — never manually set Content-Type headers
8. Reset all image state in `handleClose` and on successful submit
