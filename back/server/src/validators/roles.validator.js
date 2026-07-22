import { z } from "zod";

// POST / — create a role
export const createRoleSchema = z.object({
  roleName: z.string().min(1, "Role name is required").max(50),
  description: z.string().max(1000).optional().nullable(),
});

// PUT /:roleId — update a role
export const updateRoleSchema = z.object({
  roleName: z.string().min(1, "Role name is required").max(50),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

// POST /:roleId/permissions — replace the role's permission set
export const assignPermissionsSchema = z.object({
  permissions: z
    .array(
      z.object({
        permissionId: z.string().min(1, "permissionId is required").max(50),
        accessLevel: z.enum(["read", "write"]),
      })
    )
    .max(500),
});

// GET / — list query params
export const listRolesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(100).optional().default(""),
  status: z.enum(["Active", "Inactive"]).optional(),
  sortBy: z.enum(["dateCreated", "dateUpdated", "roleName"]).default("dateCreated"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});
