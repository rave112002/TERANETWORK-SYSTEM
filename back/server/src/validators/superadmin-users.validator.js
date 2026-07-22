import { z } from "zod";
import { optionalString } from "./_helpers.js";

// POST / — create the Owner user for a company + branch
export const createOwnerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(255),
  phone: optionalString(20),
  companyId: z.string().min(1, "companyId is required").max(50),
  branchId: z.string().min(1, "branchId is required").max(50),
});

// GET / — cross-tenant user list query params
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(100).optional().default(""),
  status: z.enum(["Active", "Inactive", "Suspended", "Deleted"]).optional(),
  companyId: z.string().max(50).optional(),
  branchId: z.string().max(50).optional(),
  sortBy: z.enum(["dateCreated", "dateUpdated", "firstName", "lastName"]).default("dateCreated"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});
