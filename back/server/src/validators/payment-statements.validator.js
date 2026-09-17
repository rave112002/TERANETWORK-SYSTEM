import { z } from "zod";

/**
 * GCash statement check — uploading the transaction-history PDF and acting on
 * what it finds (docs/payments.md).
 */

export const REVIEW_STATUSES = ["open", "not_customer"];

/**
 * POST /payment-statements — multipart: `file` (the PDF) + `password`.
 *
 * The password is used once to open the file and never stored. Empty is
 * allowed so an unprotected PDF can still be read; a protected one then
 * answers with "enter the password".
 */
export const uploadStatementSchema = z.object({
  password: z.string().max(200).optional().default(""),
});

/** POST /payment-statements/transactions/:transactionId/review */
export const reviewTransactionSchema = z.object({
  reviewStatus: z.enum(REVIEW_STATUSES, { error: "Choose a review status" }),
});

/**
 * POST /payment-statements/fix-reference — replace a recorded payment's
 * reference with the one on the statement line it was meant to be.
 */
export const fixReferenceSchema = z.object({
  paymentId: z.string().min(1, "Payment is required").max(50),
  transactionId: z.string().min(1, "Statement line is required").max(50),
});

export default {
  REVIEW_STATUSES,
  uploadStatementSchema,
  reviewTransactionSchema,
  fixReferenceSchema,
};
