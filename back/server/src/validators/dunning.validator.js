import { z } from "zod";

import { optionalString, queryEnum, queryInt } from "./_helpers.js";

/**
 * Dunning — the sweep and its human overrides.
 */

/**
 * How far ahead an exemption may run.
 *
 * Not a business rule — a guard against a mistyped year turning into indefinite
 * free service. A clerk aiming for 2026 and hitting 2062 should be stopped by
 * the form, not discovered by an auditor. If a genuine case needs longer, this
 * is one number to change, and worth raising with the client as a decision
 * rather than quietly widening.
 */
export const MAX_EXEMPTION_DAYS = 365;

/**
 * POST /sweep
 *
 * `runDate` exists for catching up after a missed night and for reproducing a
 * disputed run. A plain date, so a timezone cannot be smuggled in and shift
 * whose grace period has expired.
 */
export const runSweepSchema = z.object({
  runDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD")
    .optional(),
});

/**
 * POST /exemptions
 *
 * Both fields are required, and neither is a formality:
 *
 * `reason` has a real minimum length because "ok" tells a colleague nothing six
 * weeks later, when the question is why a four-months-overdue account is still
 * connected.
 *
 * `expiresAt` is required because an exemption with no end is not an exemption
 * — it is a silent permanent discount nobody revisits. Renewing puts the
 * decision back in front of a person.
 */
export const createExemptionSchema = z.object({
  subscriptionId: z.string().min(1, "Choose a subscription").max(50),
  reason: z
    .string()
    .trim()
    .min(5, "Say why this account is being shielded — a colleague will read this later")
    .max(255, "Keep the reason under 255 characters"),
  expiresAt: z
    .string()
    .min(10, "An end date is required")
    .refine((value) => !Number.isNaN(Date.parse(value)), "That is not a valid date")
    .refine((value) => {
      // Must be in the future. An exemption that expired before it was created
      // shields nobody, and looks like it does.
      const expiry = new Date(value).getTime();
      return expiry > Date.now();
    }, "The end date must be in the future")
    .refine((value) => {
      const days = (new Date(value).getTime() - Date.now()) / 86_400_000;
      return days <= MAX_EXEMPTION_DAYS;
    }, `An exemption cannot run more than ${MAX_EXEMPTION_DAYS} days ahead`),
});

/** POST /exemptions/:exemptionId/revoke */
export const revokeExemptionSchema = z.object({
  reason: optionalString(255),
});

// GET /exemptions
export const listExemptionsQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  // 'live' is the one that answers "who is shielded right now" — which is not
  // the same as "not revoked", since an exemption can simply run out.
  state: queryEnum(["live", "expired", "revoked"]),
  subscriptionId: optionalString(50),
});

export default {
  MAX_EXEMPTION_DAYS,
  runSweepSchema,
  createExemptionSchema,
  revokeExemptionSchema,
  listExemptionsQuerySchema,
};
