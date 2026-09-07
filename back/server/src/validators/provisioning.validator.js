import { z } from "zod";

import { optionalString, queryEnum, queryInt } from "./_helpers.js";

/**
 * Manual provisioning actions and the device action log.
 */

// POST /onus/:onuId/:action — an optional note explaining a manual intervention.
export const provisionActionSchema = z.object({
  // Not required: most actions are self-explanatory from who queued them and
  // when. When it IS given it lands on the audit row, which is where someone
  // looks to ask why a customer was cut off outside the normal sweep.
  reason: optionalString(255),
});

// GET /onus/:onuId/action-logs
export const listActionLogsQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(20, { max: 100 }),
  action: queryEnum(["activate", "deactivate", "status", "dry_run"]),
});
