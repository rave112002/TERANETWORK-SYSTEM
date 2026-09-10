import { z } from "zod";

import { optionalString, queryEnum } from "./_helpers.js";

/**
 * Reports — all read-only, all optionally exportable.
 */

/** 'YYYY-MM-DD', or absent. */
const optionalDate = (label) =>
  optionalString(10).refine(
    (v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v),
    `${label} must be YYYY-MM-DD`,
  );

/**
 * `?format=csv` returns the same rows as a download.
 *
 * A shared shape rather than three copies, so the screen and the file can never
 * be served by different filters — which is the whole reason the export is
 * trustworthy.
 */
const exportable = { format: queryEnum(["csv"]) };

// GET /aging
export const agingQuerySchema = z.object({
  ...exportable,
  // Ageing "as of" a past date, for reproducing a month-end report somebody
  // has already printed and is now querying.
  asOf: optionalDate("asOf"),
});

// GET /collections
export const collectionsQuerySchema = z.object({
  ...exportable,
  from: optionalDate("from"),
  to: optionalDate("to"),
});

// GET /subscribers
export const subscribersQuerySchema = z.object({
  ...exportable,
  status: queryEnum(["pending", "active", "suspended", "for_recovery", "terminated"]),
});

export default {
  agingQuerySchema,
  collectionsQuerySchema,
  subscribersQuerySchema,
};
