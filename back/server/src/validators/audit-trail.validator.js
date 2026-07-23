import { z } from "zod";
import {
  emptyToUndefined,
  optionalString,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

// GET / — audit trail list query params.
// Unset filters arrive as "" (see _helpers.js), including the date pickers —
// a bare `.regex()` would reject "" and 400 the default page load.
export const listAuditQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(20, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  module: optionalString(50),
  accountId: optionalString(50),
  // Accept a YYYY-MM-DD date (the controller appends the time bound itself)
  startDate: emptyToUndefined(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
      .optional(),
  ),
  endDate: emptyToUndefined(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
      .optional(),
  ),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
