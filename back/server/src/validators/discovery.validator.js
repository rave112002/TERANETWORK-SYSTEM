import { z } from "zod";

import { optionalString, queryEnum, queryInt } from "./_helpers.js";

/**
 * Discovery — sweeping a device and importing what it found.
 */

/** POST /runs — sweep one OLT. */
export const runDiscoverySchema = z.object({
  oltId: z.string().min(1, "Choose an OLT to sweep").max(50),
});

// GET /runs
export const listRunsQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  oltId: optionalString(50),
  status: queryEnum(["running", "completed", "failed"]),
});

// GET /runs/:discoveryRunId/items
export const listItemsQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(25, { max: 200 }),
  search: z.string().max(100).optional().default(""),
  // 'new' is the bucket staff act on, so it is the default view on the screen —
  // but the filter itself has no default, because "show me everything" is a
  // legitimate thing to ask for.
  matchStatus: queryEnum(["matched", "new", "orphaned"]),
  imported: queryEnum(["yes", "no"]),
});

/**
 * POST /items/:discoveredItemId/import
 *
 * Every field is optional and every one overrides what the sweep guessed.
 *
 * Nothing parsed out of an ONU description is a fact — it is a reading of free
 * text somebody typed at an installation years ago. The form pre-fills from it
 * to save typing; these values are what a person actually confirmed, and they
 * win.
 */
export const importItemSchema = z.object({
  // Placement. All optional: a modem can be imported as known-but-unplaced and
  // seated later, which is better than refusing to record a device that
  // demonstrably exists.
  oltId: optionalString(50),
  ponPortId: optionalString(50),
  napId: optionalString(50),
  napPort: z.coerce
    .number()
    .int()
    .min(1, "NAP port starts at 1")
    .max(64, "A NAP port above 64 is unrealistic")
    .optional(),

  // Identity. The service enforces that at least one of these ends up set —
  // here rather than in the schema, because either may come from the discovered
  // record instead of the form.
  mac: optionalString(17),
  serialNo: optionalString(64),
  model: optionalString(80),
  onuIndex: optionalString(32),
  description: optionalString(255),

  // Deliberately absent: `provisioningState`. It is derived from what the sweep
  // actually saw — a modem the OLT reported online is 'active', anything else
  // 'unprovisioned'. Letting a form assert it would let somebody record a
  // device as carrying service when nothing has confirmed that it is.
});

export default {
  runDiscoverySchema,
  listRunsQuerySchema,
  listItemsQuerySchema,
  importItemSchema,
};
