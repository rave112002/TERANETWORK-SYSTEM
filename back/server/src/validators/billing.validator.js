import { z } from "zod";

import { money, optionalString, queryEnum, queryInt } from "./_helpers.js";
import {
  normalizePaymentReference,
  REFERENCE_FORBIDDEN_CHANNELS,
  REFERENCE_PATTERN,
  REFERENCE_REQUIRED_CHANNELS,
} from "../lib/payments/reference.js";

/**
 * Billing — invoices, payments, adjustments, and the cycle runs.
 *
 * Money fields go through `money()` so an amount arrives as a bounded number
 * with at most two decimals; the controllers then hand it straight to
 * `money.js`. Nothing here accepts a total: an invoice's total is computed from
 * its lines and is never a value a client can assert.
 */

export const INVOICE_STATUSES = ["draft", "issued", "paid", "overdue", "void"];

/**
 * Payment channels the system recognises.
 *
 * A closed list rather than free text, because this column is what revenue is
 * grouped by — "GCash", "gcash" and "G-Cash" as three separate channels makes
 * every report wrong in a way nobody notices for a quarter.
 */
export const PAYMENT_CHANNELS = [
  "CASH",
  "BANK_TRANSFER",
  "GCASH",
  "MAYA",
  "QRPH",
  "CARD",
  "OTHER",
];

/** Adjustment kinds a person is allowed to raise by hand. */
export const ADJUSTMENT_KINDS = ["credit", "debit", "discount", "reconnection_fee", "install_fee"];

// ── Invoices ────────────────────────────────────────────────────────────────

// GET /invoices
export const listInvoicesQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(INVOICE_STATUSES),
  branchId: optionalString(50),
  customerId: optionalString(50),
  subscriptionId: optionalString(50),
  // 'YYYY-MM-DD'. Filters on the billing period, not on when the row was made:
  // "show me July" means July's service, whenever it happened to be generated.
  periodStart: optionalString(10),
  dueFrom: optionalString(10),
  dueTo: optionalString(10),
  sortBy: z.string().max(40).optional().default("dateCreated"),
  sortOrder: z.string().max(4).optional().default("DESC"),
});

/**
 * POST /invoices/:invoiceId/void
 *
 * The reason is required and cannot be blanked. A voided invoice is a hole in a
 * sequential numbering series, and "why is INV-2026-000412 missing?" has to be
 * answerable a year later by someone who was not here.
 */
export const voidInvoiceSchema = z.object({
  reason: z.string().min(3, "A reason is required").max(255),
});

// ── The cycle ───────────────────────────────────────────────────────────────

/**
 * POST /billing/cycle/run
 *
 * `runDate` picks which month to bill and exists for two real cases: catching
 * up after an outage on the 15th, and reproducing a disputed run. It is a plain
 * date so the caller cannot smuggle a timezone in and quietly bill the wrong
 * month.
 */
export const runCycleSchema = z.object({
  runDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD")
    .optional(),
  // Limit the run to one branch. Absent means every branch the caller can see.
  branchId: optionalString(50),
});

/** POST /billing/daily/run — the overdue sweep and reminders. */
export const runDailySchema = z.object({
  runDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD")
    .optional(),
});

/** POST /invoices/generate — bill one subscription now. */
export const generateInvoiceSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription is required").max(50),
  runDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD")
    .optional(),
});

// ── Payments ────────────────────────────────────────────────────────────────

// GET /payments
export const listPaymentsQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  channel: queryEnum(PAYMENT_CHANNELS),
  branchId: optionalString(50),
  customerId: optionalString(50),
  invoiceId: optionalString(50),
  paidFrom: optionalString(10),
  paidTo: optionalString(10),
});

/**
 * POST /payments — record a payment taken outside the gateway.
 *
 * The amount is still required even though it must equal the invoice total.
 * Making the clerk type it is the check: if what they were handed does not
 * match what is owed, the request is rejected rather than silently marking a
 * short payment as settled.
 *
 * `referenceNo` arrives normalised (see lib/payments/reference.js) and is the
 * duplicate guard: required for GCash and QR Ph, refused for cash, optional
 * otherwise.
 */
export const recordPaymentSchema = z
  .object({
    invoiceId: z.string().min(1, "Invoice is required").max(50),
    amount: money({ min: 0.01 }),
    channel: z.enum(PAYMENT_CHANNELS, { error: "Select a payment channel" }),
    // 'YYYY-MM-DD HH:mm:ss' or 'YYYY-MM-DD'. Absent means now — a payment banked
    // yesterday should be recorded with yesterday's date.
    paidAt: optionalString(19),
    // Normalised before the checks below, so "1234 567 890123" and
    // "1234567890123" are validated — and later deduplicated — as one value.
    referenceNo: optionalString(80).transform((v) =>
      v === undefined ? undefined : normalizePaymentReference(v) || undefined
    ),
    notes: optionalString(255),
  })
  .superRefine((body, ctx) => {
    const { channel, referenceNo } = body;

    if (REFERENCE_FORBIDDEN_CHANNELS.includes(channel) && referenceNo) {
      ctx.addIssue({
        code: "custom",
        path: ["referenceNo"],
        message: "A cash payment has no reference number",
      });
      return;
    }
    if (REFERENCE_REQUIRED_CHANNELS.includes(channel) && !referenceNo) {
      ctx.addIssue({
        code: "custom",
        path: ["referenceNo"],
        message: "Enter the transaction reference number",
      });
      return;
    }
    if (referenceNo && !REFERENCE_PATTERN.test(referenceNo)) {
      ctx.addIssue({
        code: "custom",
        path: ["referenceNo"],
        message: "A reference number is 6–64 letters and digits",
      });
    }
  });

// ── Adjustments (pending charges) ───────────────────────────────────────────

// GET /adjustments
export const listAdjustmentsQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  kind: queryEnum(ADJUSTMENT_KINDS),
  branchId: optionalString(50),
  customerId: optionalString(50),
  subscriptionId: optionalString(50),
  // "open" = not yet billed, "applied" = already on an invoice.
  applied: queryEnum(["open", "applied"]),
});

/**
 * POST /adjustments — carry a charge or a credit onto the next invoice.
 *
 * `amount` is always POSITIVE and the sign comes from `kind`, so a clerk can
 * never turn a credit into a charge with a stray minus sign. The controller
 * negates credits and discounts before storing.
 */
export const createAdjustmentSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription is required").max(50),
  kind: z.enum(ADJUSTMENT_KINDS, { error: "Select what kind of adjustment this is" }),
  description: z.string().min(3, "A description is required").max(255),
  amount: money({ min: 0.01 }),
});

export default {
  INVOICE_STATUSES,
  PAYMENT_CHANNELS,
  ADJUSTMENT_KINDS,
  listInvoicesQuerySchema,
  voidInvoiceSchema,
  runCycleSchema,
  runDailySchema,
  generateInvoiceSchema,
  listPaymentsQuerySchema,
  recordPaymentSchema,
  listAdjustmentsQuerySchema,
  createAdjustmentSchema,
};
