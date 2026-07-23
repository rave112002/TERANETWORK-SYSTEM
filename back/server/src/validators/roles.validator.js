import { z } from "zod";
import { queryEnum, queryEnumDefault, queryInt } from "./_helpers.js";

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

// GET / — list query params (unset filters arrive as "", see _helpers.js)
export const listRolesQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(["Active", "Inactive"]),
  sortBy: queryEnumDefault(["dateCreated", "dateUpdated", "roleName"], "dateCreated"),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
