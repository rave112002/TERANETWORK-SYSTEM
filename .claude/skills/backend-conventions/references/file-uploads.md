# File Upload Path Convention

> The company logo is now uploaded from the central SuperAdmin through the management API
> (`PUT /api/v1/manage/company-profile/logo`, D10). It still lands in `uploads/superadmin/logos/{companyId}/`.
> The old `POST /api/v1/upload/logo` route and the SuperAdmin-portal upload examples below are gone.

All uploaded files are stored in `public/uploads/{portal}/` with a hierarchical folder structure based on the portal and entity context.

---

## Folder Structure

```
public/uploads/
├── superadmin/
│   └── logos/{companyId}/                              ← Company/org logos (uploaded by SuperAdmin)
└── admin/
    ├── logos/{companyId}/{branchId}/                   ← Branch logos
    ├── avatars/{companyId}/{branchId}/{accountId}/     ← User avatars
    ├── signatures/{companyId}/{branchId}/{accountId}/  ← User signatures
    └── images/{companyId}/{branchId}/                  ← General images per branch
```

---

## Rules

### 1. Always prefix with portal

Every upload path starts with the portal name (`superadmin/` or `admin/`) to separate concerns.

```js
// ✅ CORRECT
filePath: (req) => `uploads/superadmin/logos/${companyId}`;
filePath: (req) => `uploads/admin/avatars/${companyId}/${branchId}/${accountId}`;

// ❌ WRONG — no portal prefix
filePath: () => "uploads/logos";
```

### 2. Always scope by companyId

Every uploaded file must include `companyId` in the path for multi-tenant isolation.

```js
// ✅ CORRECT
filePath: (req) =>
  `uploads/admin/logos/${req.user.companyId}/${req.user.branchId}`;

// ❌ WRONG — flat folder, no tenant isolation
filePath: () => "uploads/admin/logos";
```

### 3. Branch-scoped files include branchId

Files that belong to a specific branch add `branchId` to the path.

```js
filePath: (req) =>
  `uploads/admin/images/${req.user.companyId}/${req.user.branchId}`;
```

### 4. User-scoped files include accountId

Files that belong to a specific user (avatar, signature) add `accountId`.

```js
filePath: (req) =>
  `uploads/admin/avatars/${req.user.companyId}/${req.user.branchId}/${req.user.accountId}`;
```

### 5. SuperAdmin uploads use the target entity's IDs

When SuperAdmin uploads a logo for an org, use the org's `companyId` from the request body (not `req.user` since SuperAdmin has no `companyId`).

```js
filePath: (req) =>
  `uploads/superadmin/logos/${req.body.companyId || req.params.companyId}`;
```

---

## Path Pattern by Upload Type

| Upload Type    | Folder Pattern                                               | Source of IDs                              |
| -------------- | ------------------------------------------------------------ | ------------------------------------------ |
| Company logo     | `uploads/superadmin/logos/{companyId}/`                        | `req.body.companyId` or `req.params.companyId` |
| Branch logo    | `uploads/admin/logos/{companyId}/{branchId}/`                  | `req.user.*` or `req.body.*`               |
| User avatar    | `uploads/admin/avatars/{companyId}/{branchId}/{accountId}/`    | `req.user.*`                               |
| User signature | `uploads/admin/signatures/{companyId}/{branchId}/{accountId}/` | `req.user.*`                               |
| General image  | `uploads/admin/images/{companyId}/{branchId}/`                 | `req.user.*`                               |

---

## Implementation in Upload Config

```js
// SuperAdmin — company logo
const logoUpload = upload({
  filePath: (req) => {
    const companyId = req.body.companyId || req.params.companyId || "unknown";
    return `uploads/superadmin/logos/${companyId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 2,
});

// Admin — user avatar
const avatarUpload = upload({
  filePath: (req) => {
    const { companyId, branchId, accountId } = req.user;
    return `uploads/admin/avatars/${companyId}/${branchId}/${accountId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 2,
});

// Admin — general image
const imageUpload = upload({
  filePath: (req) => {
    const { companyId, branchId } = req.user;
    return `uploads/admin/images/${companyId}/${branchId}`;
  },
  fileTypes: ["images"],
  maxFileSize: 1024 * 1024 * 5,
});
```

---

## Stored Path Format

The path saved to the database is always relative from the project root, starting with `/public/`:

```
/public/uploads/superadmin/logos/{companyId}/abc123.jpg
/public/uploads/admin/avatars/{companyId}/{branchId}/{accountId}/def456.png
```

Frontend accesses via: `http://localhost:3000/public/uploads/superadmin/logos/{companyId}/abc123.jpg`

---

## Delete Behavior

When deleting a file, validate the path starts with `public/uploads/` and prevent path traversal. Only delete the file — never delete the parent directory (other files may exist there).

---

## Do / Don't

**Do:**

- Always prefix path with portal (`superadmin/` or `admin/`)
- Always include `companyId` in the upload path
- Use `req.user` for Admin portal uploads (authenticated context)
- Use `req.body` or `req.params` for SuperAdmin uploads (target entity context)
- Create directories recursively if they don't exist (`fs.mkdirSync(path, { recursive: true })`)

**Don't:**

- Don't store files without a portal prefix
- Don't store all files in a flat `uploads/` directory
- Don't use `req.user.companyId` for SuperAdmin uploads (SuperAdmin has no companyId)
- Don't allow client-provided paths — always construct server-side
- Don't delete parent folders on file delete
