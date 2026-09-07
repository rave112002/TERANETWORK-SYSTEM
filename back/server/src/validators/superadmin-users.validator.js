import { z } from "zod";
import {
  optionalString,
  optionalPhone,
  queryEnum,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

// POST / — create the Owner user for a company + branch
export const createOwnerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(255),
  phone: optionalPhone(),
  companyId: z.string().min(1, "companyId is required").max(50),
  branchId: z.string().min(1, "branchId is required").max(50),
});

/**
 * PUT /:accountId/branches — replace a user's branch assignments.
 *
 * At least one branch is required: a user with no assignment can read nothing
 * (the scope predicate fails closed), which is a broken account rather than a
 * restricted one. Deactivate the user instead.
 */
export const assignBranchesSchema = z.object({
  branchIds: z
    .array(z.string().min(1).max(50))
    .min(1, "Assign at least one branch")
    .max(50),
});

// GET / — cross-tenant user list query params (unset filters arrive as "")
export const listUsersQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(["Active", "Inactive", "Suspended", "Deleted"]),
  companyId: optionalString(50),
  branchId: optionalString(50),
  sortBy: queryEnumDefault(
    ["dateCreated", "dateUpdated", "firstName", "lastName"],
    "dateCreated",
  ),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
