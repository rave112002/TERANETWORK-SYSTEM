import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { getCurrentTimestampLocal, toTimestampLocal } from "../../../utils/dateUtils.js";
import { findAtRisk, runDunningSweep } from "../../../lib/dunning/dunning.service.js";
import {
  createExemptionSchema,
  listExemptionsQuerySchema,
  revokeExemptionSchema,
  runSweepSchema,
} from "../../../validators/dunning.validator.js";

const router = express.Router();

/**
 * Dunning — who is about to lose service, and who has been spared.
 *
 * ── The read is the important half ──────────────────────────────────────────
 *
 * `GET /at-risk` shows everyone with an overdue invoice, including those still
 * inside the grace period, with the days remaining. That is deliberately a
 * wider net than the sweep's: the point of this screen is to let staff act
 * *before* a disconnection, not to explain one afterwards. A customer who is
 * phoned on day two is worth more than one who is cut off on day three.
 *
 * ── Nothing here disconnects anybody ────────────────────────────────────────
 *
 * The sweep writes job tickets. The provisioning worker does the device work,
 * re-checks the debt immediately beforehand, and is the only thing that ever
 * flips a subscription to 'suspended'. So the worst this controller can do is
 * queue work that the worker then declines to perform.
 */

/**
 * GET /at-risk
 */
router.get(
  "/at-risk",
  checkPermission("billing", "dunning", "read"),
  catchAsync(async (req, res) => {
    const result = await findAtRisk(req.db, {
      companyId: req.user.companyId,
      branchIds: getScopedBranchIds(req.user),
    });

    // Counted here rather than in the browser so the headline figures and the
    // rows can never disagree about what "eligible" means.
    const summary = result.atRisk.reduce(
      (acc, row) => {
        acc[row.state] = (acc[row.state] ?? 0) + 1;
        return acc;
      },
      { eligible: 0, in_grace: 0, exempt: 0, suspended: 0 }
    );

    return res.sendSuccess("At-risk accounts retrieved", {
      graceDays: result.graceDays,
      cutoff: result.cutoff,
      atRisk: result.atRisk,
      summary,
    });
  })
);

/**
 * POST /sweep
 *
 * Run the sweep now, rather than waiting for tonight.
 *
 * Safe to press twice: `enqueue` dedupes on `deactivate:onu:<id>`, so a second
 * run reports the same customers as already queued instead of raising a second
 * disconnect for each.
 */
router.post(
  "/sweep",
  checkPermission("billing", "dunning", "write"),
  validateBody(runSweepSchema),
  catchAsync(async (req, res) => {
    const result = await runDunningSweep(req.db, {
      runDate: req.body.runDate || new Date(),
      companyId: req.user.companyId,
      branchIds: getScopedBranchIds(req.user),
      triggeredBy: `user:${req.user.accountId}`,
    });

    // Audited even when it queues nothing. "Who ran the sweep, and when" is a
    // question that gets asked precisely on the nights it did something
    // unexpected.
    let conn;
    try {
      conn = await req.db.beginTransaction();
      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "billing",
        action: "dunning_sweep",
        description: `Manual dunning sweep — ${result.queued} disconnect(s) queued`,
        after: {
          graceDays: result.graceDays,
          cutoff: result.cutoff,
          candidates: result.candidates,
          queued: result.queued,
          deduped: result.deduped,
          dryRun: result.dryRun,
        },
      });
      await req.db.commit(conn);
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }

    return res.sendSuccess("Dunning sweep completed", { result });
  })
);

/**
 * GET /exemptions
 */
router.get(
  "/exemptions",
  checkPermission("billing", "dunning", "read"),
  validateQuery(listExemptionsQuerySchema),
  catchAsync(async (req, res) => {
    const { page = 1, pageSize = 10, search = "", state, subscriptionId } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("de.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE de.companyId = ?${scope.clause}`;

    if (subscriptionId) {
      whereClause += " AND de.subscriptionId = ?";
      params.push(subscriptionId);
    }

    // "Live" is not the same as "not revoked": an exemption that has simply run
    // out is over without anybody having revoked it.
    if (state === "live") {
      whereClause += " AND de.status = 'Active' AND de.expiresAt > ?";
      params.push(getCurrentTimestampLocal());
    } else if (state === "expired") {
      whereClause += " AND de.status = 'Active' AND de.expiresAt <= ?";
      params.push(getCurrentTimestampLocal());
    } else if (state === "revoked") {
      whereClause += " AND de.status = 'Revoked'";
    }

    if (search) {
      whereClause += " AND (c.name LIKE ? OR c.accountNo LIKE ? OR de.reason LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const JOINS = `LEFT JOIN subscriptions s ON s.subscriptionId = de.subscriptionId
      LEFT JOIN customers c ON c.customerId = s.customerId
      LEFT JOIN users u ON u.accountId = de.createdBy`;

    const [countRows, exemptions] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM dunning_exemptions de ${JOINS} ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT de.exemptionId, de.companyId, de.branchId, de.subscriptionId, de.reason,
                de.expiresAt, de.createdBy, de.revokedBy, de.revokedAt, de.revokeReason,
                de.status, de.dateCreated, de.dateUpdated,
                c.name AS customerName, c.accountNo,
                CONCAT(u.firstName, ' ', u.lastName) AS createdByName
           FROM dunning_exemptions de ${JOINS} ${whereClause}
          ORDER BY de.dateCreated DESC
          LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Exemptions retrieved", {
      exemptions,
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
 * POST /exemptions — shield one subscription from automatic disconnection.
 */
router.post(
  "/exemptions",
  checkPermission("billing", "dunning", "write"),
  validateBody(createExemptionSchema),
  catchAsync(async (req, res) => {
    const { subscriptionId, reason, expiresAt } = req.body;
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

      if (sub.status === "terminated") {
        await req.db.rollback(conn);
        return res.sendError(
          "This subscription is terminated — there is nothing to shield from disconnection",
          409
        );
      }

      const expiry = toTimestampLocal(expiresAt);
      const now = getCurrentTimestampLocal();

      // Locked, so two clerks granting an exemption at once cannot both pass a
      // "does one already exist?" check before either inserts.
      const [existing] = await conn.execute(
        `SELECT exemptionId FROM dunning_exemptions
          WHERE subscriptionId = ? AND status = 'Active' AND expiresAt > ?
          LIMIT 1 FOR UPDATE`,
        [subscriptionId, now]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError(
          "This subscription already has a live exemption. Revoke it before granting another.",
          409
        );
      }

      const [uuidRow] = await conn.execute(`SELECT UUID() AS id`);
      const exemptionId = uuidRow[0].id;

      await conn.execute(
        `INSERT INTO dunning_exemptions
           (exemptionId, companyId, branchId, subscriptionId, reason, expiresAt,
            createdBy, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [exemptionId, companyId, sub.branchId, subscriptionId, reason, expiry, accountId, now, now]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "billing",
        action: "dunning_exemption_granted",
        description: `Exempt until ${expiry}: ${reason}`,
        after: { exemptionId, subscriptionId, reason, expiresAt: expiry },
      });

      await req.db.commit(conn);

      return res.sendSuccess(
        "Exemption granted — this account will not be disconnected automatically",
        { exemptionId, expiresAt: expiry },
        201
      );
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * POST /exemptions/:exemptionId/revoke
 *
 * Revoked, never deleted. "This customer was shielded from disconnection for
 * six weeks, by whom, and why" is exactly what an audit asks, and a deleted row
 * cannot answer it.
 */
router.post(
  "/exemptions/:exemptionId/revoke",
  checkPermission("billing", "dunning", "write"),
  validateBody(revokeExemptionSchema),
  catchAsync(async (req, res) => {
    const { exemptionId } = req.params;
    const { companyId, accountId } = req.user;

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const scope = branchScope("branchId", getScopedBranchIds(req.user));
      const [rows] = await conn.execute(
        `SELECT exemptionId, subscriptionId, reason, expiresAt, status
           FROM dunning_exemptions
          WHERE exemptionId = ? AND companyId = ?${scope.clause}
          LIMIT 1 FOR UPDATE`,
        [exemptionId, companyId, ...scope.params]
      );

      const exemption = rows[0];
      if (!exemption) {
        await req.db.rollback(conn);
        return res.sendError("Exemption not found", 404);
      }
      if (exemption.status === "Revoked") {
        await req.db.rollback(conn);
        return res.sendError("This exemption has already been revoked", 409);
      }

      const now = getCurrentTimestampLocal();
      await conn.execute(
        `UPDATE dunning_exemptions
            SET status = 'Revoked', revokedBy = ?, revokedAt = ?, revokeReason = ?, dateUpdated = ?
          WHERE exemptionId = ?`,
        [accountId, now, req.body.reason ?? null, now, exemptionId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "billing",
        action: "dunning_exemption_revoked",
        description: req.body.reason || "Exemption revoked",
        before: { reason: exemption.reason, expiresAt: exemption.expiresAt },
        after: { status: "Revoked" },
      });

      await req.db.commit(conn);

      // Said plainly: revoking does not disconnect anybody on its own. It
      // removes the shield, and the next sweep decides.
      return res.sendSuccess(
        "Exemption revoked — this account is eligible again from the next sweep",
        { exemptionId }
      );
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
