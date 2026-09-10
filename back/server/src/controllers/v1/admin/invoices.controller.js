import express from "express";
import fs from "node:fs/promises";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext } from "../../../utils/audit.js";
import { enqueue } from "../../../lib/jobs/jobs.queue.js";
import { ensureInvoicePdf } from "../../../lib/billing/invoice.render.js";
import {
  generateInvoiceForSubscription,
  runMonthlyCycle,
} from "../../../lib/billing/cycle.service.js";
import { runDailyBilling } from "../../../lib/billing/reminders.service.js";
import { voidInvoice } from "../../../lib/billing/settlement.service.js";
import { buildPayUrl } from "../../../lib/qr/payQr.js";
import {
  generateInvoiceSchema,
  listInvoicesQuerySchema,
  runCycleSchema,
  runDailySchema,
  voidInvoiceSchema,
} from "../../../validators/billing.validator.js";

const router = express.Router();

/**
 * Invoices.
 *
 * ── What this controller does not do ────────────────────────────────────────
 *
 * It does not compute anything. Every number on an invoice comes from
 * `lib/billing/`, which is pure and unit-tested; this file's job is scope,
 * permission and shape. There is deliberately no endpoint that edits a total, a
 * line amount, or a status: an issued invoice is a document that was sent to a
 * customer, and the only things that may happen to it afterwards are being paid
 * and being voided — both recorded, both leaving the original readable.
 *
 * ── Two permissions, not one ────────────────────────────────────────────────
 *
 * Reading and voiding are `billing/invoices`; running a cycle is
 * `billing/cycle`. Generating every invoice in the company is a different power
 * from looking one up, and a billing clerk should not get it by accident.
 */

const INVOICE_COLUMNS = `i.invoiceId, i.companyId, i.branchId, i.subscriptionId, i.customerId,
  i.invoiceNo, i.billingPeriodStart, i.billingPeriodEnd, i.statementDate, i.dueDate,
  i.subtotal, i.fees, i.tax, i.total, i.amountPaid, i.status, i.pdfPath, i.publicToken,
  i.issuedAt, i.paidAt, i.voidReason, i.dateCreated, i.dateUpdated`;

const JOINED_COLUMNS = `c.accountNo, c.name AS customerName, c.email AS customerEmail,
  p.name AS planName, b.name AS branchName`;

const JOINS = `LEFT JOIN customers c ON c.customerId = i.customerId
  LEFT JOIN subscriptions s ON s.subscriptionId = i.subscriptionId
  LEFT JOIN plans p ON p.planId = s.planId
  LEFT JOIN branches b ON b.branchId = i.branchId`;

/**
 * Look up one invoice within the caller's branch scope.
 *
 * Returns `null` on a scope miss, and every caller turns that into a 404. A 403
 * would confirm the invoice exists, and invoice numbers are sequential — that
 * is enough to count another branch's customers.
 */
const findScopedInvoice = async (req, invoiceId) => {
  const scope = branchScope("i.branchId", getScopedBranchIds(req.user));
  const rows = await req.db.query(
    `SELECT ${INVOICE_COLUMNS}, ${JOINED_COLUMNS}
       FROM invoices i ${JOINS}
      WHERE i.invoiceId = ? AND i.companyId = ?${scope.clause}
      LIMIT 1`,
    [invoiceId, req.user.companyId, ...scope.params]
  );
  return rows[0] ?? null;
};

/**
 * GET /
 */
router.get(
  "/",
  checkPermission("billing", "invoices", "read"),
  validateQuery(listInvoicesQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      branchId,
      customerId,
      subscriptionId,
      periodStart,
      dueFrom,
      dueTo,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("i.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE i.companyId = ?${scope.clause}`;

    if (branchId) {
      whereClause += " AND i.branchId = ?";
      params.push(branchId);
    }
    if (customerId) {
      whereClause += " AND i.customerId = ?";
      params.push(customerId);
    }
    if (subscriptionId) {
      whereClause += " AND i.subscriptionId = ?";
      params.push(subscriptionId);
    }
    if (status) {
      whereClause += " AND i.status = ?";
      params.push(status);
    }
    if (periodStart) {
      whereClause += " AND i.billingPeriodStart = ?";
      params.push(periodStart);
    }
    if (dueFrom) {
      whereClause += " AND i.dueDate >= ?";
      params.push(dueFrom);
    }
    if (dueTo) {
      whereClause += " AND i.dueDate <= ?";
      params.push(dueTo);
    }
    if (search) {
      whereClause += " AND (i.invoiceNo LIKE ? OR c.name LIKE ? OR c.accountNo LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const allowedSortColumns = ["dateCreated", "dueDate", "statementDate", "total", "status"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, invoices, totalsRows] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM invoices i ${JOINS} ${whereClause}`, params),
      req.db.query(
        `SELECT ${INVOICE_COLUMNS}, ${JOINED_COLUMNS}
           FROM invoices i ${JOINS} ${whereClause}
          ORDER BY i.${safeSortBy} ${safeSortOrder}
          LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
      // Summed across the whole filtered set, not just the page. "What is
      // outstanding" is the question this screen exists to answer, and a total
      // for the ten rows in view answers nothing.
      req.db.query(
        `SELECT
           COALESCE(SUM(CASE WHEN i.status IN ('issued','overdue') THEN i.total ELSE 0 END), 0) AS outstanding,
           COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.total ELSE 0 END), 0) AS overdue,
           COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END), 0) AS collected
         FROM invoices i ${JOINS} ${whereClause}`,
        params
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Invoices retrieved successfully", {
      invoices,
      summary: totalsRows[0] ?? { outstanding: 0, overdue: 0, collected: 0 },
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

/**
 * POST /generate — bill one subscription now, outside the monthly run.
 *
 * Declared before `/:invoiceId` so "generate" is not read as an ID.
 */
router.post(
  "/generate",
  checkPermission("billing", "cycle", "write"),
  validateBody(generateInvoiceSchema),
  catchAsync(async (req, res) => {
    const { subscriptionId, runDate } = req.body;
    const { companyId } = req.user;

    // Scoped here, before the engine sees it: the engine bills whatever it is
    // handed, which is what makes it usable from the scheduler as well.
    const scope = branchScope("branchId", getScopedBranchIds(req.user));
    const rows = await req.db.query(
      `SELECT subscriptionId FROM subscriptions
        WHERE subscriptionId = ? AND companyId = ?${scope.clause}
          AND recordStatus != 'Deleted' LIMIT 1`,
      [subscriptionId, companyId, ...scope.params]
    );
    if (rows.length === 0) return res.sendError("Subscription not found", 404);

    const result = await generateInvoiceForSubscription(req.db, subscriptionId, {
      runDate: runDate || new Date(),
      context: getAuditContext(req),
    });

    if (result.status === "skipped") {
      return res.sendSuccess("No invoice was generated", { result });
    }
    return res.sendSuccess("Invoice generated successfully", { result }, 201);
  })
);

/**
 * POST /cycle/run — the monthly run, normally fired by the scheduler on the 15th.
 *
 * Exposed to staff because the scheduler can miss: the box was down on the
 * 15th, or a run half-failed. Safe to press twice — every invoice is guarded by
 * UNIQUE(subscriptionId, billingPeriodStart), so a second run reports skips
 * rather than billing anyone again.
 */
router.post(
  "/cycle/run",
  checkPermission("billing", "cycle", "write"),
  validateBody(runCycleSchema),
  catchAsync(async (req, res) => {
    const { runDate, branchId } = req.body;
    const scoped = getScopedBranchIds(req.user);

    // `null` means every branch (SuperAdmin). A scoped user is limited to
    // theirs, and an explicit branchId must be one of them.
    let branchIds = scoped;
    if (branchId) {
      if (Array.isArray(scoped) && !scoped.includes(branchId)) {
        return res.sendError("Branch not found", 404);
      }
      branchIds = [branchId];
    }

    const result = await runMonthlyCycle(req.db, {
      runDate: runDate || new Date(),
      companyId: req.user.companyId,
      branchIds,
      context: getAuditContext(req),
    });

    return res.sendSuccess("Billing cycle completed", { result });
  })
);

/**
 * POST /daily/run — the overdue sweep and due reminders.
 *
 * Separate from the cycle because it runs every day and the cycle runs once a
 * month. Neither touches service: disconnection is the dunning sweep's call,
 * after the grace period.
 */
router.post(
  "/daily/run",
  checkPermission("billing", "cycle", "write"),
  validateBody(runDailySchema),
  catchAsync(async (req, res) => {
    // Scoped to the caller's company: the schedule that decides which invoices
    // are chased today is per company, and an unscoped run would sweep every
    // tenant's invoices against one tenant's grace period.
    const result = await runDailyBilling(req.db, {
      runDate: req.body.runDate || new Date(),
      companyId: req.user.companyId,
      context: getAuditContext(req),
    });

    return res.sendSuccess("Daily billing run completed", { result });
  })
);

/**
 * GET /:invoiceId — one invoice, with its lines and payments.
 */
router.get(
  "/:invoiceId",
  checkPermission("billing", "invoices", "read"),
  catchAsync(async (req, res) => {
    const invoice = await findScopedInvoice(req, req.params.invoiceId);
    if (!invoice) return res.sendError("Invoice not found", 404);

    const [lines, payments] = await Promise.all([
      req.db.query(
        `SELECT invoiceLineId, kind, description, qty, unitPrice, amount
           FROM invoice_lines WHERE invoiceId = ? ORDER BY sortOrder, id`,
        [invoice.invoiceId]
      ),
      req.db.query(
        `SELECT paymentId, amount, channel, provider, providerPaymentId, recordedBy, paidAt, notes
           FROM payments WHERE invoiceId = ? ORDER BY paidAt DESC`,
        [invoice.invoiceId]
      ),
    ]);

    return res.sendSuccess("Invoice retrieved successfully", {
      invoice: { ...invoice, lines, payments, payUrl: buildPayUrl(invoice.publicToken) },
    });
  })
);

/**
 * GET /:invoiceId/pdf — the rendered document.
 *
 * Streamed from `back/storage/`, which nothing serves statically, so this
 * endpoint's permission check is the only way in. Rendered on demand when the
 * file is missing.
 */
router.get(
  "/:invoiceId/pdf",
  checkPermission("billing", "invoices", "read"),
  catchAsync(async (req, res) => {
    const invoice = await findScopedInvoice(req, req.params.invoiceId);
    if (!invoice) return res.sendError("Invoice not found", 404);

    const filePath = await ensureInvoicePdf(req.db, invoice);
    const buffer = await fs.readFile(filePath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.invoiceNo}.pdf"`);
    return res.send(buffer);
  })
);

/**
 * POST /:invoiceId/void
 */
router.post(
  "/:invoiceId/void",
  checkPermission("billing", "invoices", "write"),
  validateBody(voidInvoiceSchema),
  catchAsync(async (req, res) => {
    const invoice = await findScopedInvoice(req, req.params.invoiceId);
    if (!invoice) return res.sendError("Invoice not found", 404);

    const result = await voidInvoice(req.db, {
      invoiceId: invoice.invoiceId,
      reason: req.body.reason,
      context: getAuditContext(req),
    });

    if (result.status === "already_paid") {
      return res.sendError(
        "A paid invoice cannot be voided. Record a refund or a credit adjustment instead.",
        409
      );
    }
    if (result.status === "already_void") {
      return res.sendError("This invoice is already void", 409);
    }
    if (result.status === "not_found") return res.sendError("Invoice not found", 404);

    return res.sendSuccess("Invoice voided", { invoiceId: invoice.invoiceId });
  })
);

/**
 * POST /:invoiceId/resend — queue the invoice email again.
 *
 * The dedupe key carries a timestamp, unlike the one the cycle uses. A resend
 * is a deliberate act by someone who has just been told the customer never got
 * it, and it must not be swallowed as a duplicate of the original send.
 */
router.post(
  "/:invoiceId/resend",
  checkPermission("billing", "invoices", "write"),
  catchAsync(async (req, res) => {
    const invoice = await findScopedInvoice(req, req.params.invoiceId);
    if (!invoice) return res.sendError("Invoice not found", 404);

    if (invoice.status === "void") {
      return res.sendError("A voided invoice cannot be sent to a customer", 409);
    }
    if (!invoice.customerEmail) {
      return res.sendError("This customer has no email address on file", 409);
    }

    let conn;
    try {
      conn = await req.db.beginTransaction();
      const { jobId } = await enqueue(conn, {
        companyId: invoice.companyId,
        branchId: invoice.branchId,
        type: "email",
        payload: {
          kind: "invoice_issued",
          invoiceId: invoice.invoiceId,
          customerId: invoice.customerId,
        },
        dedupeKey: `email:invoice_issued:${invoice.invoiceId}:resend:${Date.now()}`,
      });
      await req.db.commit(conn);

      return res.sendSuccess("Invoice queued for sending", {
        jobId,
        recipient: invoice.customerEmail,
      });
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
