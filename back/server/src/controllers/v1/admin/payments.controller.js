import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext } from "../../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { enqueue } from "../../../lib/jobs/jobs.queue.js";
import { settleInvoice } from "../../../lib/billing/settlement.service.js";
import { formatAmount } from "../../../lib/money/money.js";
import {
  listPaymentsQuerySchema,
  recordPaymentSchema,
} from "../../../validators/billing.validator.js";

const router = express.Router();

/**
 * Payments taken outside the gateway — cash at the office, a bank transfer, a
 * GCash send confirmed by hand.
 *
 * ── This endpoint does not settle anything itself ───────────────────────────
 *
 * It validates, scopes, and calls `settleInvoice()`, the same function the
 * payment gateway's webhook calls. That is the whole point: a cash payment and
 * an online
 * payment must mark an invoice paid identically — same idempotency, same exact
 * amount rule, same reconnection — or the two paths drift and one of them
 * eventually leaves a paying customer disconnected.
 *
 * ── There is no DELETE ──────────────────────────────────────────────────────
 *
 * A payment recorded in error is corrected by recording a reversal, not by
 * removing the row. What somebody believed, and when, is the part that matters
 * when the money is disputed months later.
 */

const PAYMENT_COLUMNS = `p.paymentId, p.companyId, p.branchId, p.invoiceId, p.customerId,
  p.amount, p.channel, p.provider, p.providerPaymentId, p.recordedBy, p.paidAt,
  p.notes, p.dateCreated`;

const JOINED_COLUMNS = `i.invoiceNo, i.total AS invoiceTotal, i.status AS invoiceStatus,
  c.name AS customerName, c.accountNo, b.name AS branchName,
  CONCAT(u.firstName, ' ', u.lastName) AS recordedByName`;

const JOINS = `LEFT JOIN invoices i ON i.invoiceId = p.invoiceId
  LEFT JOIN customers c ON c.customerId = p.customerId
  LEFT JOIN branches b ON b.branchId = p.branchId
  LEFT JOIN users u ON u.accountId = p.recordedBy`;

/**
 * GET /
 */
router.get(
  "/",
  checkPermission("billing", "payments", "read"),
  validateQuery(listPaymentsQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      channel,
      branchId,
      customerId,
      invoiceId,
      paidFrom,
      paidTo,
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("p.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE p.companyId = ?${scope.clause}`;

    if (branchId) {
      whereClause += " AND p.branchId = ?";
      params.push(branchId);
    }
    if (customerId) {
      whereClause += " AND p.customerId = ?";
      params.push(customerId);
    }
    if (invoiceId) {
      whereClause += " AND p.invoiceId = ?";
      params.push(invoiceId);
    }
    if (channel) {
      whereClause += " AND p.channel = ?";
      params.push(channel);
    }
    if (paidFrom) {
      whereClause += " AND p.paidAt >= ?";
      params.push(`${paidFrom} 00:00:00`);
    }
    if (paidTo) {
      // Inclusive of the whole day: a date filter that silently drops
      // everything after midnight is a report that undercounts today.
      whereClause += " AND p.paidAt <= ?";
      params.push(`${paidTo} 23:59:59`);
    }
    if (search) {
      whereClause += " AND (i.invoiceNo LIKE ? OR c.name LIKE ? OR c.accountNo LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows, payments, totalRows] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM payments p ${JOINS} ${whereClause}`, params),
      req.db.query(
        `SELECT ${PAYMENT_COLUMNS}, ${JOINED_COLUMNS}
           FROM payments p ${JOINS} ${whereClause}
          ORDER BY p.paidAt DESC
          LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
      req.db.query(
        `SELECT COALESCE(SUM(p.amount), 0) AS collected FROM payments p ${JOINS} ${whereClause}`,
        params
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Payments retrieved successfully", {
      payments,
      summary: { collected: totalRows[0]?.collected ?? 0 },
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
 * POST / — record a payment against an invoice.
 */
router.post(
  "/",
  checkPermission("billing", "payments", "write"),
  validateBody(recordPaymentSchema),
  catchAsync(async (req, res) => {
    const { invoiceId, amount, channel, paidAt, notes } = req.body;
    const { companyId, accountId } = req.user;

    const scope = branchScope("branchId", getScopedBranchIds(req.user));
    const rows = await req.db.query(
      `SELECT invoiceId, invoiceNo, total, status, companyId, branchId, customerId
         FROM invoices WHERE invoiceId = ? AND companyId = ?${scope.clause} LIMIT 1`,
      [invoiceId, companyId, ...scope.params]
    );
    const invoice = rows[0];
    if (!invoice) return res.sendError("Invoice not found", 404);

    const result = await settleInvoice(req.db, {
      invoiceId: invoice.invoiceId,
      amount,
      channel,
      recordedBy: accountId,
      paidAt: paidAt || null,
      context: getAuditContext(req),
    });

    if (result.status === "amount_mismatch") {
      // Named exactly, because the clerk has cash in hand and needs to know
      // whether to take more or give change — not "invalid amount".
      return res.sendError(
        `This invoice is for ${formatAmount(result.expected)}, but ${formatAmount(result.got)} was entered. Partial payments are not accepted.`,
        422
      );
    }
    if (result.status === "already_paid") {
      return res.sendError("This invoice has already been paid", 409);
    }
    if (result.status === "void") {
      return res.sendError("A voided invoice cannot be paid", 409);
    }
    if (result.status === "not_found") return res.sendError("Invoice not found", 404);

    // The note is not part of settlement — it is bookkeeping colour on the row,
    // and settleInvoice is shared with the webhook, which never has one.
    if (notes && result.paymentId) {
      await req.db.query(`UPDATE payments SET notes = ? WHERE paymentId = ?`, [
        notes,
        result.paymentId,
      ]);
    }

    // The receipt goes out after the money is committed, never inside the
    // settlement transaction — a mail server being slow must not be able to
    // roll back a payment.
    let conn;
    try {
      conn = await req.db.beginTransaction();
      await enqueue(conn, {
        companyId: invoice.companyId,
        branchId: invoice.branchId,
        type: "email",
        payload: {
          kind: "payment_received",
          invoiceId: invoice.invoiceId,
          customerId: invoice.customerId,
          payment: { amount, channel, paidAt: paidAt || getCurrentTimestampLocal() },
          reconnecting: Boolean(result.reconnectQueued),
        },
        dedupeKey: `email:payment_received:${result.paymentId}`,
      });
      await req.db.commit(conn);
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }

    return res.sendSuccess(
      result.reconnectQueued
        ? "Payment recorded. The customer's connection is being restored."
        : "Payment recorded",
      { paymentId: result.paymentId, reconnectQueued: Boolean(result.reconnectQueued) },
      201
    );
  })
);

export default router;
