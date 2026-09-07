import { z } from "zod";

import {
  optionalString,
  queryEnum,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

/**
 * Subscriptions — the customer + plan + ONU binding.
 *
 * `status` is deliberately absent from both the create and update schemas. It
 * moves through {@link transitionSchema} instead, because a lifecycle with
 * rules ("you cannot activate something already terminated", "suspension comes
 * from the device") is not a field a form should be able to overwrite.
 */

export const SUBSCRIPTION_STATUSES = ["pending", "active", "suspended", "terminated"];

const subscriptionShape = {
  customerId: z.string().min(1, "Customer is required").max(50),
  planId: z.string().min(1, "Plan is required").max(50),
  // Optional: a connection can be sold and scheduled before a modem is seated.
  // The subscription simply cannot be activated until one is attached.
  onuId: optionalString(50),
  notes: optionalString(2000),
};

// POST / — create a subscription (always starts `pending`)
export const createSubscriptionSchema = z.object(subscriptionShape);

// PUT /:subscriptionId — edit the binding
export const updateSubscriptionSchema = z.object(subscriptionShape);

/**
 * POST /:subscriptionId/status — move through the lifecycle.
 *
 * Only the two staff-owned transitions are accepted here. `suspend` and
 * `restore` are absent on purpose: those mirror what the OLT is actually doing
 * and are written by the provisioning worker, in the same transaction as the
 * ONU's own state. Exposing them as buttons would let the database claim a
 * customer is cut off — or reconnected — when the hardware disagrees.
 */
export const transitionSchema = z.object({
  action: z.enum(["activate", "terminate"], {
    error: "Action must be 'activate' or 'terminate'",
  }),
  // Required on terminate: "why did this customer leave" is unanswerable a year
  // later without it, and terminate is the one irreversible transition.
  reason: optionalString(255),
});

// GET / — list query params (a cleared filter arrives as "", see _helpers.js)
export const listSubscriptionsQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(SUBSCRIPTION_STATUSES),
  recordStatus: queryEnum(["Active", "Deleted"]),
  branchId: optionalString(50),
  customerId: optionalString(50),
  planId: optionalString(50),
  sortBy: queryEnumDefault(
    ["dateCreated", "dateUpdated", "activatedAt", "status"],
    "dateCreated",
  ),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
