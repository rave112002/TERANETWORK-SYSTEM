import { z } from "zod";

// POST /:accountId — set a single per-user permission override
export const setUserPermissionSchema = z.object({
  permissionId: z.string().min(1, "permissionId is required").max(50),
  accessLevel: z.enum(["none", "read", "write"]),
});

// POST /:accountId/bulk — replace all of a user's overrides
export const bulkUserPermissionsSchema = z.object({
  permissions: z
    .array(
      z.object({
        permissionId: z.string().min(1, "permissionId is required").max(50),
        accessLevel: z.enum(["none", "read", "write"]),
      })
    )
    .max(500),
});
