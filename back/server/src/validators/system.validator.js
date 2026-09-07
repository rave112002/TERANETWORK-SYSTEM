import { z } from "zod";

import { optionalString, queryEnum, queryEnumDefault, queryInt } from "./_helpers.js";

/**
 * System settings and the job queue.
 *
 * Each setting is validated by its own rule rather than as a free-text
 * key/value pair. These are values that decide whether customers get
 * disconnected and what they are charged — "a string" is not a specification.
 */

// PUT /settings — every field optional; send only what is changing.
export const updateSettingsSchema = z
  .object({
    // The kill switch. Boolean, and only a boolean.
    DRY_RUN: z.boolean().optional(),
    // 0 is the client's configured value, not a missing one — see
    // lib/settings/settings.service.js.
    GRACE_DAYS: z.coerce
      .number({ error: "Grace days must be a number" })
      .int("Grace days must be a whole number of days")
      .min(0, "Grace days cannot be negative")
      .max(365, "More than a year of grace is almost certainly a mistake")
      .optional(),
    // A fraction, not a percentage: 0.12, never 12. The upper bound is what
    // stops a percentage being entered by mistake and multiplying every bill.
    VAT_RATE: z.coerce
      .number({ error: "VAT rate must be a number" })
      .min(0, "VAT rate cannot be negative")
      .max(1, "Enter VAT as a fraction, e.g. 0.12 for 12%")
      .optional(),
    RECONNECTION_FEE_ENABLED: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one setting to update",
  });

// GET /jobs — the queue view
export const listJobsQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(20, { max: 100 }),
  status: queryEnum([
    "queued",
    "processing",
    "succeeded",
    "failed",
    "dead",
    "cancelled",
  ]),
  type: queryEnum(["deactivate", "activate", "status", "email"]),
  branchId: optionalString(50),
  sortBy: queryEnumDefault(["dateCreated", "dateUpdated", "nextRunAt"], "dateCreated"),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
