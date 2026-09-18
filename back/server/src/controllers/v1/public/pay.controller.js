import express from "express";
import fs from "node:fs/promises";

import { catchAsync } from "../../../utils/catchAsync.js";
import { strictLimiter } from "../../../middlewares/rateLimiter.js";
import { ensureInvoicePdf } from "../../../lib/billing/invoice.render.js";
import { createPaymentForInvoice } from "../../../lib/payments/payment.service.js";
import {
  gatewayStatusForBranch,
  resolveGatewayForBranch,
} from "../../../lib/payment-gateways/index.js";
import { logger } from "../../../../config/logger.js";

const router = express.Router();

/**
 * The customer-facing payment page's data, reached by an invoice's
 * `publicToken` and nothing else.
 *
 * ── Why there is no login here ──────────────────────────────────────────────
 *
 * The people paying these bills are residential subscribers. An account they
 * have to create, remember and reset is a barrier between an ISP and its
 * revenue, and every ISP that has tried it ends up taking most payments over
 * the counter anyway. The link in the email is the credential.
 *
 * ── What that costs, and how it is bounded ──────────────────────────────────
 *
 * A link is a bearer credential: anyone who has it can see the invoice. So:
 *
 *   - the token is 128 bits from `crypto.randomBytes`, not derived from the
 *     invoice number, the customer id, or anything else guessable;
 *   - it is rate-limited, so a wrong token cannot be hunted for at speed;
 *   - a wrong token gets exactly the same 404 as a deleted one — there is no
 *     response that distinguishes "no such invoice" from "not this one";
 *   - the response carries only what a person needs to recognise and pay their
 *     own bill. No customer id, no subscription id, no address, no phone, no
 *     branch, and no other invoice.
 *
 * That last one is the rule to keep when extending this file: a field belongs
 * here only if a customer looking at their own bill would need it.
 */

/**
 * The public shape of an invoice. Deliberately not the row.
 *
 * @param {Object} row a joined invoice row.
 * @param {Array} lines its invoice lines.
 * @param {Object} gateway the status of THIS branch's gateway, from
 *   `gatewayStatusForBranch`. Passed in rather than read here, so the shape
 *   stays a pure function of its inputs.
 * @returns {Object}
 */
const toPublicInvoice = (row, lines, gateway) => ({
  invoiceNo: row.invoiceNo,
  status: row.status,
  billingPeriodStart: row.billingPeriodStart,
  billingPeriodEnd: row.billingPeriodEnd,
  statementDate: row.statementDate,
  dueDate: row.dueDate,
  subtotal: row.subtotal,
  fees: row.fees,
  tax: row.tax,
  total: row.total,
  paidAt: row.paidAt,
  // The customer's own name, so they can tell at a glance that the link is
  // theirs. Not the address, and not the account number.
  customerName: row.customerName,
  companyName: row.companyName,
  companyEmail: row.companyEmail,
  companyPhone: row.companyPhone,
  lines: lines.map((l) => ({
    description: l.description,
    qty: l.qty,
    amount: l.amount,
  })),
  // Whether the page should offer to pay, and how. Computed here rather than
  // inferred in the browser, so the button's existence and the server's
  // willingness to honour it can never disagree.
  payment: {
    enabled: row.status === "issued" || row.status === "overdue",
    online: gateway.configured,
    testMode: gateway.testMode,
    provider: gateway.provider,
  },
});

/**
 * Look up an invoice by its public token.
 *
 * @param {Object} db
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
const findByToken = async (db, token) => {
  // Length-checked before the query: the column is CHAR(32), and a 4,000
  // character "token" is someone probing, not a customer.
  if (typeof token !== "string" || !/^[0-9a-f]{32}$/.test(token)) return null;

  const rows = await db.query(
    `SELECT i.*, c.name AS customerName,
            co.name AS companyName, co.email AS companyEmail, co.phone AS companyPhone
       FROM invoices i
       JOIN customers c ON c.customerId = i.customerId
       JOIN companies co ON co.companyId = i.companyId
      WHERE i.publicToken = ? LIMIT 1`,
    [token]
  );

  return rows[0] ?? null;
};

/**
 * GET /invoices/:token
 */
router.get(
  "/invoices/:token",
  strictLimiter,
  catchAsync(async (req, res) => {
    const invoice = await findByToken(req.db, req.params.token);
    if (!invoice) return res.sendError("This payment link is not valid", 404);

    const lines = await req.db.query(
      `SELECT description, qty, amount FROM invoice_lines
        WHERE invoiceId = ? ORDER BY sortOrder, id`,
      [invoice.invoiceId]
    );

    return res.sendSuccess("Invoice retrieved", {
      invoice: toPublicInvoice(invoice, lines, await gatewayStatusForBranch(req.db, invoice.branchId)),
    });
  })
);

/**
 * GET /invoices/:token/pdf — the customer's own copy.
 */
router.get(
  "/invoices/:token/pdf",
  strictLimiter,
  catchAsync(async (req, res) => {
    const invoice = await findByToken(req.db, req.params.token);
    if (!invoice) return res.sendError("This payment link is not valid", 404);

    const filePath = await ensureInvoicePdf(req.db, invoice);
    const buffer = await fs.readFile(filePath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.invoiceNo}.pdf"`);
    return res.send(buffer);
  })
);

/**
 * POST /invoices/:token/pay
 *
 * Open a checkout for this invoice and hand back somewhere to send the
 * customer. Safe to call repeatedly: an already-open session is reused rather
 * than replaced, so a double-clicked button cannot produce two live checkouts
 * for one bill.
 *
 * Rate-limited like the reads. This one costs a call to the gateway, so an
 * unthrottled loop here would be somebody else's bill as well as ours.
 */
router.post(
  "/invoices/:token/pay",
  strictLimiter,
  catchAsync(async (req, res) => {
    const invoice = await findByToken(req.db, req.params.token);
    if (!invoice) return res.sendError("This payment link is not valid", 404);

    const customer = await req.db.query(
      `SELECT c.name, c.email, co.name AS companyName
         FROM customers c JOIN companies co ON co.companyId = c.companyId
        WHERE c.customerId = ? LIMIT 1`,
      [invoice.customerId]
    );

    const result = await createPaymentForInvoice(req.db, {
      ...invoice,
      customerName: customer[0]?.name,
      customerEmail: customer[0]?.email,
      companyName: customer[0]?.companyName,
    });

    if (result.status === "not_payable") {
      // The exact reason, because the three cases need different actions from
      // the customer: nothing, wait, or call us.
      const message =
        result.reason === "paid"
          ? "This invoice has already been paid"
          : result.reason === "void"
            ? "This invoice was cancelled and cannot be paid"
            : "This invoice is not ready for payment yet";
      return res.sendError(message, 409);
    }

    if (result.status === "unavailable") {
      logger.warn(`[pay] checkout unavailable for ${invoice.invoiceNo}: ${result.reason}`);
      return res.sendError(
        "Online payment is not available right now. Please contact us to settle this invoice.",
        503
      );
    }

    return res.sendSuccess("Checkout ready", {
      paymentUrl: result.paymentUrl,
      reused: result.status === "reused",
    });
  })
);

/**
 * POST /invoices/:token/simulate
 *
 * The customer's side of a mock checkout — the buttons a hosted payment page
 * would show. Present ONLY while the mock gateway is active, so it cannot exist
 * in a deployment that takes real money.
 *
 * It deliberately does not settle anything itself. It builds the callback the
 * gateway would send, signature and all, and the caller POSTs that at the real
 * webhook endpoint. The simulated payment therefore travels the same path as a
 * real one — verification, replay guard, settlement, reconnection — rather than
 * around it, which is the only way a rehearsal proves anything.
 */
router.post(
  "/invoices/:token/simulate",
  strictLimiter,
  catchAsync(async (req, res) => {
    const invoice = await findByToken(req.db, req.params.token);
    if (!invoice) return res.sendError("This payment link is not valid", 404);

    // Resolved for THIS invoice's branch, and after the invoice is found rather
    // than before. A branch collecting through a real gateway must have no
    // simulator at all, even while another branch of the same company is still
    // on the mock.
    const gateway = await resolveGatewayForBranch(req.db, invoice.branchId);

    if (gateway.name !== "mock" || typeof gateway.simulateCallback !== "function") {
      return res.sendError("Not found", 404);
    }

    const { providerRef, outcome = "paid", channel = "GCASH" } = req.body ?? {};
    if (!providerRef) return res.sendError("providerRef is required", 400);

    // The attempt must belong to THIS invoice. Without that check the simulator
    // would settle any invoice whose reference you could guess — harmless in
    // development, and precisely the habit that ships.
    const attempts = await req.db.query(
      `SELECT paymentAttemptId FROM payment_attempts
        WHERE providerRef = ? AND invoiceId = ? LIMIT 1`,
      [providerRef, invoice.invoiceId]
    );
    if (attempts.length === 0) return res.sendError("Unknown payment attempt", 404);

    const callback = gateway.simulateCallback(providerRef, { outcome, channel });
    if (!callback) return res.sendError("That checkout session has expired", 409);

    return res.sendSuccess("Callback prepared", {
      webhookPath: `/api/v1/public/webhooks/${gateway.name}`,
      signatureHeader: "x-mock-signature",
      signature: callback.signature,
      body: callback.body,
    });
  })
);

export default router;
