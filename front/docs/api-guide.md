# API Service Guide

When creating or modifying API services and React Query hooks, follow the API guide.

---

## Backend Response Shape (MEMORIZE THIS)

All backend endpoints use `res.sendSuccess()` which wraps responses in:

```json
{
  "success": true,
  "message": "Items retrieved successfully",
  "data": {
    "items": [...],
    "pagination": { "page": 1, "pageSize": 10, "total": 50, "totalPages": 5 }
  }
}
```

### How to access data in React Query hooks

The API service (`services/api/`) returns `response.data` which gives:

```js
{ success, message, data: { items: [...], pagination: {...} } }
```

React Query's `data` is that full object. So in hooks:

```js
// ✅ CORRECT — access the nested data property, then the entity array
const { data: apiData } = useGetItems(filters);
const items = apiData?.data?.items || [];
const pagination = apiData?.data?.pagination || {};

// ❌ WRONG — apiData.data is the wrapper object, NOT the array
const items = apiData?.data || []; // This is { items: [...], pagination: {...} }
```

### Response shape by endpoint type

| Endpoint Type | `res.sendSuccess` payload      | Access in hook             |
| ------------- | ------------------------------ | -------------------------- |
| List          | `{ users: [...], pagination }` | `apiData?.data?.users`     |
| Single        | `{ user: {...} }`              | `apiData?.data?.user`      |
| Create        | `{ accountId }`                | `apiData?.data?.accountId` |
| Update        | (no data)                      | `apiData?.message`         |
| Delete        | (no data)                      | `apiData?.message`         |

### In page hooks (return shape)

Always unwrap to the final array/object before returning from your hook:

```js
// In hooks.jsx
return {
  data: {
    users: apiData?.data?.users || [],
    pagination: apiData?.data?.pagination || {},
  },
};
```

### In mutation onSuccess callbacks

```js
onSuccess: (response) => {
  // response = { success, message, data: { ... } }
  const { user, token } = response.data;
};
```

---

## Folder Structure

```
src/services/
├── api/                          # Raw API calls (axios)
│   ├── axios.js                  # Axios instance + interceptors
│   ├── [portal]/                 # admin/ or superadmin/
│   │   ├── [module].js           # If module has NO sub-modules
│   │   └── [module]/             # If module HAS sub-modules
│   │       ├── [submodule].js
│   │       └── [submodule].js
│   │
│   ├── admin/
│   │   ├── auth.js
│   │   ├── user.js
│   │   ├── roles.js
│   │   ├── permissions.js
│   │   └── user-permissions.js
│   └── superadmin/
│       ├── auth.js
│       └── companies.js
│
└── requests/                     # React Query hooks (same structure as api/)
    ├── [portal]/
    │   ├── [module].js
    │   └── [module]/
    │       ├── [submodule].js
    │       └── [submodule].js
    │
    ├── admin/
    │   ├── auth.js
    │   └── user.js
    └── superadmin/
        ├── auth.js
        └── companies.js
```

---

## Rules

1. **`api/` files** — Raw axios calls only. No React hooks, no state, no UI logic.
2. **`requests/` files** — React Query hooks (`useQuery`, `useMutation`). Import from the corresponding `api/` file.
3. **No try/catch** — Let errors propagate to React Query's `onError` handlers.
4. **Folder mirrors** — `api/` and `requests/` always have the same folder structure.
5. **File naming** — Use the module name in lowercase (e.g., `user.js`, `roles.js`, `companies.js`).

---

## Step-by-Step: Adding a New API Module

### 1. Create the API file

**Location:** `src/services/api/[portal]/[module].js`

> If the module handles file uploads, also create `const apiMultipart = createAxiosInstanceWithInterceptor("multipart", userTypeAuth.admin)` — see "Multipart form data" section below.

```js
import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

export const getItemsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/items", { params: filters });
  return response.data;
};

export const getItemByIdApi = async (itemId) => {
  const response = await api.get(`/api/v1/admin/items/${itemId}`);
  return response.data;
};

export const createItemApi = async (itemData) => {
  const response = await api.post("/api/v1/admin/items", itemData);
  return response.data;
};

export const updateItemApi = async (itemId, itemData) => {
  const response = await api.put(`/api/v1/admin/items/${itemId}`, itemData);
  return response.data;
};

export const deleteItemApi = async (itemId) => {
  const response = await api.delete(`/api/v1/admin/items/${itemId}`);
  return response.data;
};
```

---

### 2. Create the React Query hooks file

**Location:** `src/services/requests/[portal]/[module].js`

```js
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import {
  getItemsApi,
  getItemByIdApi,
  createItemApi,
  updateItemApi,
  deleteItemApi,
} from "../../api/admin/items";

// Query: Get all items
export const useGetItems = (filters = {}) => {
  return useQuery({
    queryKey: ["items", filters],
    queryFn: () => getItemsApi(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Query: Get single item
export const useGetItemById = (itemId) => {
  return useQuery({
    queryKey: ["items", itemId],
    queryFn: () => getItemByIdApi(itemId),
    enabled: !!itemId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutation: Create item
export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createItemApi,
    onSuccess: () => {
      message.success("Item created successfully");
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to create item");
    },
  });
};

// Mutation: Update item
export const useUpdateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, itemData }) => updateItemApi(itemId, itemData),
    onSuccess: (data, variables) => {
      message.success("Item updated successfully");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items", variables.itemId] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to update item");
    },
  });
};

// Mutation: Delete item
export const useDeleteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteItemApi,
    onSuccess: () => {
      message.success("Item deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to delete item");
    },
  });
};
```

---

## Patterns

### API file pattern (no try/catch)

```js
// ✅ Correct — clean, errors propagate naturally
export const getItemsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/items", { params: filters });
  return response.data;
};

// ❌ Wrong — unnecessary try/catch that just re-throws
export const getItemsApi = async (filters = {}) => {
  try {
    const response = await api.get("/api/v1/admin/items", { params: filters });
    return response.data;
  } catch (error) {
    throw error;
  }
};
```

### Multipart form data (file uploads)

The project provides two axios instance types via `createAxiosInstanceWithInterceptor`:

| Type          | Usage                   | Content-Type          |
| ------------- | ----------------------- | --------------------- |
| `"data"`      | JSON payloads (default) | `application/json`    |
| `"multipart"` | File uploads (FormData) | `multipart/form-data` |

When a module needs file uploads, create **both** instances and pick based on the payload:

```js
import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);
const apiMultipart = createAxiosInstanceWithInterceptor(
  "multipart",
  userTypeAuth.admin,
);

// Endpoint that may or may not have a file
export const createItemApi = async (data) => {
  const isFormData = data instanceof FormData;
  const instance = isFormData ? apiMultipart : api;
  const response = await instance.post("/api/v1/admin/items", data);
  return response.data;
};

export const updateItemApi = async (itemId, data) => {
  const isFormData = data instanceof FormData;
  const instance = isFormData ? apiMultipart : api;
  const response = await instance.put(`/api/v1/admin/items/${itemId}`, data);
  return response.data;
};
```

**Rules:**

1. Never manually set `Content-Type` headers — the instance handles it
2. Use `data instanceof FormData` to pick the correct instance
3. Both instances share the same auth token, CSRF token, and idempotency key interceptors
4. The `"multipart"` instance is cached — creating it multiple times returns the same instance

### Query key conventions

| Pattern         | Example                            |
| --------------- | ---------------------------------- |
| List all        | `["items", filters]`               |
| Single item     | `["items", itemId]`                |
| Nested resource | `["items", itemId, "permissions"]` |
| Invalidate all  | `queryKey: ["items"]`              |

---

## Checklist when adding a new API module

- [ ] Created `src/services/api/[portal]/[module].js` with all CRUD functions
- [ ] Created `src/services/requests/[portal]/[module].js` with React Query hooks
- [ ] No try/catch wrappers
- [ ] Used consistent query keys

---

## Query Invalidation Rules

### 1. Use object syntax

```js
// ✅ CORRECT
queryClient.invalidateQueries({ queryKey: ["roles"] });

// ❌ WRONG — old array syntax
queryClient.invalidateQueries(["roles"]);
```

### 2. Invalidate only what changed

| After this mutation          | Invalidate                                 |
| ---------------------------- | ------------------------------------------ |
| Create/update/delete a role  | `["roles"]`                                |
| Assign permissions to a role | `["rolePermissions", roleId]`, `["roles"]` |
| Create/update/delete a user  | `["users"]`                                |
| Update user permissions      | `["userPermissions", accountId]`           |

### 3. Never invalidate `["userPermissions"]` broadly

Only invalidate current user's permissions if YOU changed YOUR OWN permissions.

### 4. Let mutations handle invalidation

Invalidation belongs in the mutation hook's `onSuccess` — not in page components. Don't call `refetch()` manually.
