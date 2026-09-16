# File Upload Path Convention

All uploaded files are stored in `public/uploads/{portal}/` with a hierarchical folder structure based on the portal and entity context.

---

## Folder Structure

```
public/uploads/
├── superadmin/
│   └── logos/{systemId}/                  ← System logos (uploaded by SuperAdmin)
└── admin/
    ├── logos/{systemId}/                  ← System logos (uploaded from the Admin portal)
    ├── avatars/{systemId}/{accountId}/    ← User avatars
    ├── signatures/{systemId}/{accountId}/ ← User signatures
    └── images/{systemId}/                 ← General images per system
```

---

## Rules

### 1. Always prefix with portal

Every upload path starts with the portal name (`superadmin/` or `admin/`) to separate concerns.

```js
// ✅ CORRECT
filePath: (req) => `uploads/superadmin/logos/${systemId}`;
filePath: (req) => `uploads/admin/avatars/${systemId}/${accountId}`;

// ❌ WRONG — no portal prefix
filePath: () => "uploads/logos";
```

### 2. Always scope by systemId

Every uploaded file must include `systemId` in the path for multi-tenant isolation. Tenancy is a
single level — there is no second `branchId` segment.

```js
// ✅ CORRECT
filePath: (req) => `uploads/admin/logos/${req.user.systemId}`;

// ❌ WRONG — flat folder, no tenant isolation
filePath: () => "uploads/admin/logos";
```

### 3. User-scoped files include accountId

Files that belong to a specific user (avatar, signature) add `accountId` after the system.

```js
filePath: (req) =>
  `uploads/admin/avatars/${req.user.systemId}/${req.user.accountId}`;
```

### 4. SuperAdmin uploads use the target entity's IDs

When SuperAdmin uploads a logo for a system, use that system's `systemId` from the request body (not `req.user`, since SuperAdmin has no `systemId`).

```js
filePath: (req) =>
  `uploads/superadmin/logos/${req.body.systemId || req.params.systemId}`;
```

---

## Path Pattern by Upload Type

| Upload Type    | Folder Pattern                                    | Source of IDs                                |
| -------------- | ------------------------------------------------- | -------------------------------------------- |
| System logo    | `uploads/superadmin/logos/{systemId}/`            | `req.body.systemId` or `req.params.systemId` |
| User avatar    | `uploads/admin/avatars/{systemId}/{accountId}/`   | `req.user.*`                                 |
| User signature | `uploads/admin/signatures/{systemId}/{accountId}/`| `req.user.*`                                 |
| General image  | `uploads/admin/images/{systemId}/`                | `req.user.*`                                 |

---

## Implementation in Upload Config

```js
// SuperAdmin — system logo
const logoUpload = upload({
  filePath: (req) => {
    const systemId = req.body.systemId || req.params.systemId || "unknown";
    return `uploads/superadmin/logos/${systemId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 2,
});

// Admin — user avatar
const avatarUpload = upload({
  filePath: (req) => {
    const { systemId, accountId } = req.user;
    return `uploads/admin/avatars/${systemId}/${accountId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 2,
});

// Admin — general image
const imageUpload = upload({
  filePath: (req) => {
    const { systemId } = req.user;
    return `uploads/admin/images/${systemId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 5,
});
```

---

## Stored Path Format

The path saved to the database is always relative from the project root, starting with `/public/`:

```
/public/uploads/superadmin/logos/{systemId}/abc123.jpg
/public/uploads/admin/avatars/{systemId}/{accountId}/def456.png
```

Frontend accesses via: `http://localhost:3000/public/uploads/superadmin/logos/{systemId}/abc123.jpg`

---

## Delete Behavior

When deleting a file, validate the path starts with `public/uploads/` and prevent path traversal. Only delete the file — never delete the parent directory (other files may exist there).

---

## Do / Don't

**Do:**

- Always prefix path with portal (`superadmin/` or `admin/`)
- Always include `systemId` in the upload path
- Use `req.user` for Admin portal uploads (authenticated context)
- Use `req.body` or `req.params` for SuperAdmin uploads (target entity context)
- Create directories recursively if they don't exist (`fs.mkdirSync(path, { recursive: true })`)

**Don't:**

- Don't store files without a portal prefix
- Don't store all files in a flat `uploads/` directory
- Don't use `req.user.systemId` for SuperAdmin uploads (SuperAdmin has no systemId)
- Don't allow client-provided paths — always construct server-side
- Don't delete parent folders on file delete
