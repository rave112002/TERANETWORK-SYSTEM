import { z } from "zod";

import {
  money,
  optionalString,
  queryEnum,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

/**
 * Service plans — the speed/price catalogue.
 *
 * `.max()` on each string mirrors the column width in schema.sql, and every
 * money field is `DECIMAL(12,2)`. Speeds are whole Mbps (`INT UNSIGNED`), so a
 * fractional or negative value is rejected here rather than truncated by MySQL.
 */

const speed = (label) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number of Mbps`)
    .positive(`${label} must be greater than 0`)
    .max(100000, `${label} is unrealistically high`);

const planShape = {
  name: z.string().trim().min(1, "Plan name is required").max(100),
  description: optionalString(1000),
  downMbps: speed("Download speed"),
  upMbps: speed("Upload speed"),
  monthlyPrice: money(),
  // Charged once, on a subscription's first invoice.
  installFee: money({ required: false }),
  // Zero by client decision — kept as a mechanism, not a live charge.
  reconnectionFee: money({ required: false }),
};

// POST / — create a plan
export const createPlanSchema = z.object(planShape);

// PUT /:planId — update a plan
export const updatePlanSchema = z.object({
  ...planShape,
  status: z.enum(["Active", "Inactive"]).optional(),
});

// GET / — list query params (a cleared filter arrives as "", see _helpers.js)
export const listPlansQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(["Active", "Inactive", "Deleted"]),
  sortBy: queryEnumDefault(
    ["dateCreated", "dateUpdated", "name", "monthlyPrice", "downMbps"],
    "dateCreated",
  ),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
