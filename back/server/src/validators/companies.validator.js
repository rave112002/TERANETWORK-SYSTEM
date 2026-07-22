import { z } from "zod";
import { emptyToUndefined, optionalString } from "./_helpers.js";

// These endpoints are multipart/form-data (logo upload), so every field arrives
// as a string and unset optional fields arrive as "". `emptyToUndefined` treats
// "" as absent so optional enums/strings pass.

const SUBSCRIPTION_PLANS = ["Basic", "Standard", "Premium", "Enterprise"];
const COMPANY_STATUSES = ["Active", "Inactive", "Suspended", "Pending", "Deleted"];

// POST / — create a company
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  website: optionalString(255),
  subscriptionPlan: emptyToUndefined(z.enum(SUBSCRIPTION_PLANS).optional().default("Basic")),
});

// PUT /:companyId — update a company
export const updateCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  website: optionalString(255),
  logoUrl: optionalString(255),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS),
  // Accepts "YYYY-MM-DD" or a full ISO datetime string; the DATE column truncates
  subscriptionStartDate: optionalString(30),
  subscriptionEndDate: optionalString(30),
  status: emptyToUndefined(z.enum(COMPANY_STATUSES).optional()),
});

// GET / — list query params
export const listCompaniesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(100).optional().default(""),
  status: z.enum(COMPANY_STATUSES).optional(),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS).optional(),
  sortBy: z.enum(["dateCreated", "dateUpdated", "name"]).default("dateCreated"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});
