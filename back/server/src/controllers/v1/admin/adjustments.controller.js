import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { money, toAmount } from "../../../lib/money/money.js";
import {
  createAdjustmentSchema,
  listAdjustmentsQuerySchema,
} from "../../../validators/billing.validator.js";

const router = express.Router();

/**
 * Adjustments — credits, discounts and one-off charges that ride onto the next
 * invoice.
 *
 * ── Why they wait rather than editing an invoice ────────────────────────────
 *
 * A customer who complains on the 20th is complaining about an invoice already
 * issued, already emailed, already possibly printed. Editing that document
 * means the copy in their inbox and the copy in the system disagree, and the
 * only way to tell which is right is to ask the database — which is exactly the
 * position an ISP does not want to be in during a billing dispute.
 *
 * So the adjustment is recorded as a pending charge and lands on the NEXT
 * invoice as its own line, with its own description. The customer sees what
 * changed and why, on a document that has never said anything else.
 *
 * ── Signs are set here, not by the caller ───────────────────────────────────
 *
 * The API takes a positive amount and a `kind`; credits and discounts are
 * negated on the way in. A clerk cannot turn a credit into a charge with a
 * stray minus sign, and a UI cannot get it wrong by round-tripping a value.
 */

/** Kinds that reduce a bill. Everything else adds to it. */
const NEGATIVE_KINDS = new Set(["credit", "discount"]);

const ADJUSTMENT_COLUMNS = `pc.pendingChargeId, pc.companyId, pc.branchId, pc.customerId,
  pc.subscriptionId, pc.kind, pc.description, pc.amount, pc.appliedInvoiceId, pc.appliedAt,
  pc.createdBy, pc.status, pc.dateCreated, pc.dateUpdated`;

const JOINED_COLUMNS = `c.name AS customerName, c.accountNo, b.name AS branchName,
  i.invoiceNo AS appliedInvoiceNo,
  CONCAT(u.firstName, ' ', u.lastName) AS createdByName`;

const JOINS = `LEFT JOIN customers c ON c.customerId = pc.customerId
  LEFT JOIN branches b ON b.branchId = pc.branchId
  LEFT JOIN invoices i ON i.invoiceId = pc.appliedInvoiceId
  LEFT JOIN users u ON u.accountId = pc.createdBy`;

/**
 * GET /
 */
router.get(
  "/",
  checkPermission("billing", "adjustments", "read"),
  validateQuery(listAdjustmentsQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      kind,
      branchId,
      customerId,
      subscriptionId,
      applied,
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("pc.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE pc.companyId = ?${scope.clause} AND pc.status != 'Deleted'`;

    if (branchId) {
      whereClause += " AND pc.branchId = ?";
      params.push(branchId);
    }
    if (customerId) {
      whereClause += " AND pc.customerId = ?";
      params.push(customerId);
    }
    if (subscriptionId) {
      whereClause += " AND pc.subscriptionId = ?";
      params.push(subscriptionId);
    }
    if (kind) {
      whereClause += " AND pc.kind = ?";
      params.push(kind);
    }
    if (applied === "open") whereClause += " AND pc.appliedInvoiceId IS NULL";
    if (applied === "applied") whereClause += " AND pc.appliedInvoiceId IS NOT NULL";

    if (search) {
      whereClause += " AND (pc.description LIKE ? OR c.name LIKE ? OR c.accountNo LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows, adjustments] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM pending_charges pc ${JOINS} ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT ${ADJUSTMENT_COLUMNS}, ${JOINED_COLUMNS}
           FROM pending_charges pc ${JOINS} ${whereClause}
          ORDER BY pc.dateCreated DESC
          LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Adjustments retrieved successfully", {
      adjustments,
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
 * POST /
 */
router.post(
  "/",
  checkPermission("billing", "adjustments", "write"),
  validateBody(createAdjustmentSchema),
  catchAsync(async (req, res) => {
    const { subscriptionId, kind, description, amount } = req.body;
    const { companyId, accountId } = req.user;

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const scope = branchScope("branchId", getScopedBranchIds(req.user));
      const [subs] = await conn.execute(
        `SELECT subscriptionId, branchId, customerId, status FROM subscriptions
          WHERE subscriptionId = ? AND companyId = ?${scope.clause}
            AND recordStatus != 'Deleted' LIMIT 1`,
        [subscriptionId, companyId, ...scope.params]
      );

      const sub = subs[0];
      if (!sub) {
        await req.db.rollback(conn);
        return res.sendError("Subscription not found", 404);
      }

      // A terminated subscription will never be billed again, so a charge
      // against one would sit unapplied forever. Better to refuse it than to
      // let somebody believe a credit was granted.
      if (sub.status === "terminated") {
        await req.db.rollback(conn);
        return res.sendError(
          "This subscription is terminated and will not be invoiced again",
          409
        );
      }

      const signed = NEGATIVE_KINDS.has(kind)
        ? money(amount).negated().toFixed(2)
        : toAmount(amount);

      const [uuidRow] = await conn.execute(`SELECT UUID() AS id`);
      const pendingChargeId = uuidRow[0].id;
      const now = getCurrentTimestampLocal();

      await conn.execute(
        `INSERT INTO pending_charges
           (pendingChargeId, companyId, branchId, customerId, subscriptionId, kind,
            description, amount, createdBy, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pendingChargeId,
          companyId,
          sub.branchId,
          sub.customerId,
          subscriptionId,
          kind,
          description,
          signed,
          accountId,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "billing",
        action: "adjustment_created",
        description: `${kind}: ${description}`,
        after: { pendingChargeId, subscriptionId, kind, amount: signed },
      });

      await req.db.commit(conn);

      return res.sendSuccess(
        "Adjustment recorded. It will appear on the next invoice.",
        { pendingChargeId, amount: signed },
        201
      );
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:pendingChargeId
 *
 * Only while it is still unapplied. Once it is on an invoice it is a line on a
 * document the customer has, and removing it here would silently change what
 * they were charged without changing the invoice itself.
 */
router.delete(
  "/:pendingChargeId",
  checkPermission("billing", "adjustments", "write"),
  catchAsync(async (req, res) => {
    const { pendingChargeId } = req.params;
    const { companyId } = req.user;

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const scope = branchScope("branchId", getScopedBranchIds(req.user));
      const [rows] = await conn.execute(
        `SELECT pendingChargeId, kind, description, amount, appliedInvoiceId
           FROM pending_charges
          WHERE pendingChargeId = ? AND companyId = ?${scope.clause}
            AND status != 'Deleted'
          LIMIT 1 FOR UPDATE`,
        [pendingChargeId, companyId, ...scope.params]
      );

      const charge = rows[0];
      if (!charge) {
        await req.db.rollback(conn);
        return res.sendError("Adjustment not found", 404);
      }

      if (charge.appliedInvoiceId) {
        await req.db.rollback(conn);
        return res.sendError(
          "This adjustment is already on an invoice. Void that invoice, or record an opposite adjustment.",
          409
        );
      }

      const now = getCurrentTimestampLocal();
      await conn.execute(
        `UPDATE pending_charges SET status = 'Deleted', dateUpdated = ? WHERE pendingChargeId = ?`,
        [now, pendingChargeId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "billing",
        action: "adjustment_deleted",
        description: `${charge.kind}: ${charge.description}`,
        before: { amount: charge.amount },
      });

      await req.db.commit(conn);
      return res.sendSuccess("Adjustment removed", { pendingChargeId });
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
