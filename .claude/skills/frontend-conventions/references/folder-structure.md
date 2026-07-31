# Folder Structure

When creating new pages, modules, or components, follow the folder structure guide.

---

## Pages Directory

All page modules live under `src/pages/` organized by portal type.

```
src/pages/
├── Admin/                    # Admin portal
│   ├── [Module]/             # Module without sub-modules
│   │   ├── index.jsx         # Main page component
│   │   ├── hooks.jsx         # Module-specific hooks (API calls, state, columns)
│   │   └── components/       # Module-specific components (forms, modals, drawers)
│   │
│   └── [Module]/             # Module with sub-modules
│       ├── [SubModule]/
│       │   ├── index.jsx
│       │   ├── hooks.jsx
│       │   └── components/
│       └── [SubModule]/
│           ├── index.jsx
│           ├── hooks.jsx
│           └── components/
│
├── SuperAdmin/               # SuperAdmin portal
│   ├── [Module]/
│   │   ├── index.jsx
│   │   ├── hooks.jsx
│   │   └── components/
│   └── ...
│
└── LandingPage.jsx           # Public landing page (no module folder needed)
```

---

## Rules

1. **Portal folders:** `Admin/` and `SuperAdmin/` are the two portal roots. All modules go inside one of these.
2. **Module folder:** Always a PascalCase directory (e.g., `Dashboard/`, `UserManagement/`, `Companies/`).
3. **No sub-modules:** The module folder directly contains `index.jsx`, `hooks.jsx`, and `components/`.
4. **With sub-modules:** The module folder contains sub-module folders, each with their own `index.jsx`, `hooks.jsx`, and `components/`.
5. **Never** put page logic directly in the portal folder (e.g., never `Admin/index.jsx` for a page — only `Admin/Login.jsx` for the login page is an exception).
6. **`index.jsx`** — The main page component. This is what gets lazy-loaded in the route file.
7. **`hooks.jsx`** — All hooks for the module: API query/mutation calls, table columns, state management, action handlers.
8. **`components/`** — Module-specific components: forms, modals, drawers, view components. Each has its own file. Import directly from the file (no barrel `index.js`).

---

## Examples

### Module without sub-modules

```
src/pages/Admin/Dashboard/
├── index.jsx                 # Dashboard page
├── hooks.jsx                 # useDashboardHooks()
└── components/
    └── StatsOverview.jsx
```

```
src/pages/SuperAdmin/Companies/
├── index.jsx                 # Companies list page
├── hooks.jsx                 # useCompanyHooks()
├── CompanyForm.jsx      # Create/Edit form (can live at module root if it's the only form)
└── components/
    └── ViewCompanyModal.jsx
```

### Module with sub-modules

```
src/pages/Admin/UserManagement/
├── Users/
│   ├── index.jsx             # Users list page
│   ├── hooks.jsx             # useUserHooks()
│   └── components/
│       ├── UserForm.jsx
│       ├── UserViewModal.jsx
│       └── UserPermissionsDrawer.jsx
│
└── Roles/
    ├── index.jsx             # Roles list page
    ├── hooks.jsx             # useRoleHooks()
    └── components/
        ├── RoleForm.jsx
        └── PermissionsDrawer.jsx
```

---

## File Responsibilities

| File          | Purpose                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.jsx`   | Page layout, renders UI using hooks and components. Handles filter visibility, loading/error states, and composes the page structure.                                                     |
| `hooks.jsx`   | Exports a single custom hook (e.g., `useUserHooks`). Contains: API calls via React Query, table column definitions, pagination state, row selection, modal/drawer state, action handlers. |
| `components/` | Reusable pieces specific to this module: forms, modals, drawers, cards. Each component is its own file.                                                                                   |

---

## Naming Conventions

| Item              | Convention                 | Example                                                         |
| ----------------- | -------------------------- | --------------------------------------------------------------- |
| Portal folder     | PascalCase                 | `Admin/`, `SuperAdmin/`                                         |
| Module folder     | PascalCase                 | `Dashboard/`, `UserManagement/`                                 |
| Sub-module folder | PascalCase                 | `Users/`, `Roles/`                                              |
| Page component    | PascalCase, default export | `const UsersPage = () => {}`                                    |
| Hooks file        | camelCase hook name        | `export const useUserHooks = () => {}`                          |
| Component files   | PascalCase                 | `UserForm.jsx`, `ViewCompanyModal.jsx`                     |
| Barrel export     | N/A                        | Import directly: `import UserForm from "./components/UserForm"` |

---

## Route Registration

**⚠️ IMPORTANT:** Every time a new page/module is created, you MUST also register it in the corresponding route file. A page that isn't registered here won't be accessible.

Route files:

```
src/routes/pageRoutes/
├── AdminRoute.jsx            # Registers all Admin portal routes + navigation
└── SuperAdminRoute.jsx       # Registers all SuperAdmin portal routes + navigation
```

### Steps to register a new page:

1. **Add the lazy import** at the top of the route file
2. **Add a navigation entry** in the `navigations` array (this controls both the sidebar menu AND the route)
3. **Add the permission** so the sidebar filters correctly

### Navigation entry structure:

```jsx
// 1. Lazy import
const NewModule = lazy(() => import("../../pages/Admin/NewModule"));

// 2. Navigation entry — module WITHOUT sub-modules
{
  route: "/new-module",
  name: "New Module",
  label: "New Module",
  icon: <SomeLucideIcon className="h-5 w-5" />,
  component: (
    <Suspense fallback={<ComponentLoader />}>
      <ProtectedRoute module="new_module" accessLevel="read">
        <NewModule />
      </ProtectedRoute>
    </Suspense>
  ),
  permission: { module: "new_module", submodule: null, accessLevel: "read" },
  isFilter: true,
  isShow: true,
}
```

**Optional `section`:** add `section: "system"` to render the item below the sidebar's divider with
the other system links (Settings, Audit Trail). Omit it for normal modules — anything without a
`section` renders in the main group, in order.

### Navigation entry — module WITH sub-modules:

```jsx
// Lazy imports
const SubModuleA = lazy(() => import("../../pages/Admin/MyModule/SubModuleA"));
const SubModuleB = lazy(() => import("../../pages/Admin/MyModule/SubModuleB"));

// Navigation entry — parent uses `anyOf` so it shows if user has ANY sub-module permission
{
  key: "my-module",
  name: "My Module",
  label: "My Module",
  icon: <SomeLucideIcon className="h-5 w-5" />,
  permission: {
    anyOf: [
      { module: "my_module", submodule: "sub_a", accessLevel: "read" },
      { module: "my_module", submodule: "sub_b", accessLevel: "read" },
    ],
  },
  isFilter: true,
  isShow: true,
  children: [
    {
      route: "/sub-a",
      name: "Sub Module A",
      label: "Sub Module A",
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <ProtectedRoute module="my_module" submodule="sub_a" accessLevel="read">
            <SubModuleA />
          </ProtectedRoute>
        </Suspense>
      ),
      permission: { module: "my_module", submodule: "sub_a", accessLevel: "read" },
      isFilter: true,
      isShow: true,
    },
    {
      route: "/sub-b",
      name: "Sub Module B",
      label: "Sub Module B",
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <ProtectedRoute module="my_module" submodule="sub_b" accessLevel="read">
            <SubModuleB />
          </ProtectedRoute>
        </Suspense>
      ),
      permission: { module: "my_module", submodule: "sub_b", accessLevel: "read" },
      isFilter: true,
      isShow: true,
    },
  ],
}
```

### Permission patterns:

| Scenario                       | Permission structure                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Simple module (no sub-modules) | `{ module: "module_name", submodule: null, accessLevel: "read" }`                         |
| Parent with sub-modules        | `{ anyOf: [{ module, submodule, accessLevel }, ...] }` — shows if user has ANY sub-module |
| Child sub-module               | `{ module: "module_name", submodule: "sub_name", accessLevel: "read" }`                   |

### Checklist when adding a new page:

- [ ] Created the page folder with `index.jsx`, `hooks.jsx`, `components/`
- [ ] Added lazy import in the route file
- [ ] Added navigation entry with `route`, `name`, `label`, `icon`, `component`, `permission`
- [ ] Added permission record to the `permissions` table in the database
- [ ] Added API service files in `src/services/api/` and `src/services/requests/`

---

## Services (API Layer)

API files mirror the portal structure:

```
src/services/
├── api/
│   ├── admin/
│   │   ├── auth.js
│   │   ├── user.js
│   │   ├── roles.js
│   │   └── permissions.js
│   └── superadmin/
│       ├── auth.js
│       └── companies.js
└── requests/
    ├── admin/
    │   ├── auth.js           # React Query hooks for admin auth
    │   └── user.js           # React Query hooks for users
    └── superadmin/
        ├── auth.js
        └── companies.js
```

---

## Shared Components

Components used across multiple modules live in `src/components/`:

```
src/components/
├── layout/
│   ├── BasicLayout.jsx
│   └── Sidebar.jsx
├── ErrorBoundary.jsx
├── LoadingFallback.jsx
├── ProtectedRoute.jsx
├── PasswordStrengthIndicator.jsx
├── StatCard.jsx
└── ThemeToggle.jsx
```

**Rule:** If a component is used by more than one module, move it to `src/components/`. If it's only used within one module, keep it in that module's `components/` folder.
