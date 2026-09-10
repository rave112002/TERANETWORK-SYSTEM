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

/**
 * Which gateway this branch collects through.
 *
 * Deliberately NOT a `z.enum` of the known slugs. The set of adapters is a
 * property of the running code, and duplicating it here means a new adapter
 * works everywhere except the one form that assigns it. `resolveGateway` is
 * where an unknown slug is caught, and it falls back rather than failing, so a
 * typo costs a log line instead of a branch's billing.
 *
 * Empty string clears it, which is how "follow the company default" is said in
 * an HTML form.
 */
const paymentProvider = () => optionalString(30);

// POST / — create a branch (also provisions the Owner role)
export const createBranchSchema = z.object({
  companyId: z.string().min(1, "companyId is required").max(50),
  name: z.string().min(1, "Branch name is required").max(100),
  email: optionalEmail(100),
  phone: optionalPhone(),
  address: optionalString(1000),
  paymentProvider: paymentProvider(),
});

// PUT /:branchId — update a branch
export const updateBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").max(100),
  email: optionalEmail(100),
  phone: optionalPhone(),
  address: optionalString(1000),
  paymentProvider: paymentProvider(),
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
