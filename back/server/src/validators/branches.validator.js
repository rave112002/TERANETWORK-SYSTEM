import { z } from "zod";
import {
  optionalString,
  optionalEmail,
  optionalPhone,
  queryEnum,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

const BRANCH_STATUSES = ["Active", "Inactive", "Suspended", "Deleted"];

// POST / — create a branch (also provisions the Owner role)
export const createBranchSchema = z.object({
  companyId: z.string().min(1, "companyId is required").max(50),
  name: z.string().min(1, "Branch name is required").max(100),
  email: optionalEmail(100),
  phone: optionalPhone(),
  address: optionalString(1000),
});

// PUT /:branchId — update a branch
export const updateBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").max(100),
  email: optionalEmail(100),
  phone: optionalPhone(),
  address: optionalString(1000),
  status: z.enum(BRANCH_STATUSES).optional(),
});

// GET / — list query params (unset filters arrive as "", see _helpers.js)
export const listBranchesQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(BRANCH_STATUSES),
  companyId: optionalString(50),
  sortBy: queryEnumDefault(["dateCreated", "dateUpdated", "name"], "dateCreated"),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
