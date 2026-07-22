import { z } from "zod";
import { optionalString, optionalEmail } from "./_helpers.js";

const BRANCH_STATUSES = ["Active", "Inactive", "Suspended", "Deleted"];

// POST / — create a branch (also provisions the Owner role)
export const createBranchSchema = z.object({
  companyId: z.string().min(1, "companyId is required").max(50),
  name: z.string().min(1, "Branch name is required").max(100),
  email: optionalEmail(100),
  phone: optionalString(20),
  address: optionalString(1000),
});

// PUT /:branchId — update a branch
export const updateBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").max(100),
  email: optionalEmail(100),
  phone: optionalString(20),
  address: optionalString(1000),
  status: z.enum(BRANCH_STATUSES).optional(),
});

// GET / — list query params
export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(100).optional().default(""),
  status: z.enum(BRANCH_STATUSES).optional(),
  companyId: z.string().max(50).optional(),
  sortBy: z.enum(["dateCreated", "dateUpdated", "name"]).default("dateCreated"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});
