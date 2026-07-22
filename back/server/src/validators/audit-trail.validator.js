import { z } from "zod";

// GET / — audit trail list query params
export const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional().default(""),
  module: z.string().max(50).optional(),
  accountId: z.string().max(50).optional(),
  // Accept a YYYY-MM-DD date (the controller appends the time bound itself)
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
    .optional(),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});
