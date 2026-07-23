import { z } from "zod";
import {
  emptyToUndefined,
  optionalString,
  optionalPhone,
  queryEnum,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

// These endpoints are multipart/form-data (logo upload), so every field arrives
// as a string and unset optional fields arrive as "". `emptyToUndefined` treats
// "" as absent so optional enums/strings pass.

const SUBSCRIPTION_PLANS = ["Basic", "Standard", "Premium", "Enterprise"];
const COMPANY_STATUSES = ["Active", "Inactive", "Suspended", "Pending", "Deleted"];

// POST / — create a company
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  phone: optionalPhone(),
  website: optionalString(255),
  subscriptionPlan: emptyToUndefined(z.enum(SUBSCRIPTION_PLANS).optional().default("Basic")),
});

// PUT /:companyId — update a company
export const updateCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  phone: optionalPhone(),
  website: optionalString(255),
  logoUrl: optionalString(255),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS),
  // Accepts "YYYY-MM-DD" or a full ISO datetime string; the DATE column truncates
  subscriptionStartDate: optionalString(30),
  subscriptionEndDate: optionalString(30),
  status: emptyToUndefined(z.enum(COMPANY_STATUSES).optional()),
});

// GET / — list query params (unset filters arrive as "", see _helpers.js)
export const listCompaniesQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(COMPANY_STATUSES),
  subscriptionPlan: queryEnum(SUBSCRIPTION_PLANS),
  sortBy: queryEnumDefault(["dateCreated", "dateUpdated", "name"], "dateCreated"),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
