import { z } from "zod";

// POST / — create an admin user (+ credential)
export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(255),
  phone: z.string().max(20).optional().nullable(),
  roleId: z.string().min(1, "Role is required").max(50),
});

// PUT /:userId — update an admin user
export const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  phone: z.string().max(20).optional().nullable(),
  roleId: z.string().min(1, "Role is required").max(50),
  status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
});

// GET / — list query params
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(100).optional().default(""),
  status: z.enum(["Active", "Inactive", "Suspended", "Deleted"]).optional(),
  sortBy: z.enum(["dateCreated", "dateUpdated", "firstName", "lastName"]).default("dateCreated"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});
