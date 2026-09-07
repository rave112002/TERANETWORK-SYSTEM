import { z } from "zod";
import { emptyToUndefined, optionalPhone, queryEnum, queryEnumDefault, queryInt } from "./_helpers.js";

/**
 * Branches to assign the user to (`user_branches`). Omitted means "the creating
 * user's own home branch" — the common case, and what every pre-multi-branch
 * client sends. The first entry becomes the user's home branch. Each ID is
 * checked against the caller's own scope in the controller, so a branch the
 * caller cannot see can never be assigned.
 */
const optionalBranchIds = emptyToUndefined(
  z.array(z.string().min(1).max(50)).min(1, "Select at least one branch").max(50).optional()
);

// POST / — create an admin user (+ credential)
export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(255),
  phone: optionalPhone(),
  roleId: z.string().min(1, "Role is required").max(50),
  branchIds: optionalBranchIds,
});

// PUT /:userId — update an admin user
export const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  phone: optionalPhone(),
  roleId: z.string().min(1, "Role is required").max(50),
  status: z.enum(["Active", "Inactive", "Suspended"]).optional(),
  branchIds: optionalBranchIds,
});

// GET / — list query params (unset filters arrive as "", see _helpers.js)
export const listUsersQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(["Active", "Inactive", "Suspended", "Deleted"]),
  sortBy: queryEnumDefault(
    ["dateCreated", "dateUpdated", "firstName", "lastName"],
    "dateCreated",
  ),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
