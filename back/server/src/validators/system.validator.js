import { z } from "zod";

import { optionalString, queryEnum, queryEnumDefault, queryInt } from "./_helpers.js";

/**
 * System settings and the job queue.
 *
 * Each setting is validated by its own rule rather than as a free-text
 * key/value pair. These are values that decide whether customers get
 * disconnected and what they are charged — "a string" is not a specification.
 */

/** A day the calendar has in every month. See the note in the schema below. */
const dayOfMonth = (label) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole day`)
    .min(1, `${label} must be at least the 1st`)
    .max(28, `${label} must be the 28th or earlier — later days do not exist in February`)
    .optional();

/** An hour on a 24-hour clock. */
const hourOfDay = (label) =>
  z.coerce
    .number({ error: `${label} must be an hour` })
    .int(`${label} must be a whole hour`)
    .min(0, `${label} must be between 00:00 and 23:00`)
    .max(23, `${label} must be between 00:00 and 23:00`)
    .optional();

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

    // ── The billing schedule ────────────────────────────────────────────────
    //
    // Each of these is checked on its own here. How they sit TOGETHER — the
    // statement day having to fall after the cut-off day, the daily notice
    // having to run before the disconnection sweep — cannot be checked here,
    // because an update is partial: a request that changes only the due day is
    // valid or not depending on the stored statement day. The controller merges
    // the two and calls `validateBillingSchedule`.
    //
    // Day-of-month values stop at 28, the last day present in every month, so a
    // schedule cannot move on its own each February.
    STATEMENT_DAY: dayOfMonth("Statement day"),
    DUE_DAY: dayOfMonth("Due day"),
    REMINDER_DAYS_BEFORE: z.coerce
      .number({ error: "Reminder lead time must be a number" })
      .int("Whole days only")
      .min(0, "Cannot be negative")
      .max(28, "A reminder more than 28 days ahead would land in the wrong month")
      .optional(),
    CYCLE_HOUR: hourOfDay("The billing run"),
    DAILY_HOUR: hourOfDay("The daily notice run"),
    DUNNING_HOUR: hourOfDay("The disconnection sweep"),

    // How long a suspended account waits before staff are prompted to send a
    // technician for the modem. At least a day: zero would put somebody on the
    // pull-out list the same evening they were cut off.
    RECOVERY_AFTER_DAYS: z.coerce
      .number({ error: "Days before pull-out must be a number" })
      .int("Whole days only")
      .min(1, "At least one day — the same evening they were cut off is not a decision")
      .max(365, "More than a year of waiting is almost certainly a mistake")
      .optional(),
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
