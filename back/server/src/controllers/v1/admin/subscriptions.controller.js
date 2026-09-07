import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { findScopedRow } from "../../../lib/network/network.helpers.js";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  transitionSchema,
  listSubscriptionsQuerySchema,
} from "../../../validators/subscriptions.validator.js";

const router = express.Router();

/**
 * Subscriptions — what makes a customer billable.
 *
 * ── The lifecycle, and who owns each edge ───────────────────────────────────
 *
 *   pending   → active       staff, via POST /:id/status { action: 'activate' }
 *   active    → suspended    the DUNNING WORKER, after the OLT confirms the cut
 *   suspended → active       the PAYMENT PATH, after the OLT confirms restore
 *   any       → terminated   staff, via POST /:id/status { action: 'terminate' }
 *
 * Only the staff edges live here. Suspension and restoration mirror what the
 * device is actually doing and are written by the worker in the same
 * transaction as the ONU's state — if this controller could set them, the
 * system would bill on a belief the hardware does not share, and the dunning
 * sweep reads exactly this column to decide who to cut off.
 */

const SUBSCRIPTION_COLUMNS = `s.subscriptionId, s.companyId, s.branchId, s.customerId,
  s.planId, s.onuId, s.status, s.activatedAt, s.terminatedAt, s.notes,
  s.recordStatus, s.dateCreated, s.dateUpdated`;

const JOINED_COLUMNS = `c.accountNo, c.name AS customerName, c.email AS customerEmail,
  p.name AS planName, p.monthlyPrice, p.downMbps, p.upMbps,
  o.mac AS onuMac, o.serialNo AS onuSerialNo, o.provisioningState,
  b.name AS branchName`;

const JOINS = `LEFT JOIN customers c ON c.customerId = s.customerId
  LEFT JOIN plans p ON p.planId = s.planId
  LEFT JOIN onus o ON o.onuId = s.onuId
  LEFT JOIN branches b ON b.branchId = s.branchId`;

/** Scoped lookup for the routes that mutate a subscription. */
const findScopedSubscription = (conn, req, subscriptionId, opts = {}) =>
  findScopedRow(conn, req, {
    table: "subscriptions",
    idColumn: "subscriptionId",
    id: subscriptionId,
    label: "Subscription",
    statusColumn: "recordStatus",
    ...opts,
  });

/**
 * GET /
 */
router.get(
  "/",
  checkPermission("subscriptions", null, "read"),
  validateQuery(listSubscriptionsQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      recordStatus,
      branchId,
      customerId,
      planId,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("s.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE s.companyId = ?${scope.clause}`;

    if (branchId) {
      whereClause += " AND s.branchId = ?";
      params.push(branchId);
    }
    if (customerId) {
      whereClause += " AND s.customerId = ?";
      params.push(customerId);
    }
    if (planId) {
      whereClause += " AND s.planId = ?";
      params.push(planId);
    }
    if (status) {
      whereClause += " AND s.status = ?";
      params.push(status);
    }

    if (recordStatus) {
      whereClause += " AND s.recordStatus = ?";
      params.push(recordStatus);
    } else {
      whereClause += " AND s.recordStatus != 'Deleted'";
    }

    if (search) {
      whereClause +=
        " AND (c.name LIKE ? OR c.accountNo LIKE ? OR c.email LIKE ? OR o.mac LIKE ? OR p.name LIKE ?)";
      params.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "activatedAt", "status"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, subscriptions] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM subscriptions s ${JOINS} ${whereClause}`,
        params
      ),
      req.db.query(
        `SELECT ${SUBSCRIPTION_COLUMNS}, ${JOINED_COLUMNS}
         FROM subscriptions s
         ${JOINS}
         ${whereClause}
         ORDER BY s.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Subscriptions retrieved successfully", {
      subscriptions,
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
 * GET /:subscriptionId
 */
router.get(
  "/:subscriptionId",
  checkPermission("subscriptions", null, "read"),
  catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("s.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT ${SUBSCRIPTION_COLUMNS}, ${JOINED_COLUMNS}
       FROM subscriptions s
       ${JOINS}
       WHERE s.subscriptionId = ? AND s.companyId = ?${scope.clause}
         AND s.recordStatus != 'Deleted'
       LIMIT 1`,
      [subscriptionId, companyId, ...scope.params]
    );

    if (rows.length === 0) {
      return res.sendError("Subscription not found", 404);
    }

    return res.sendSuccess("Subscription retrieved successfully", {
      subscription: rows[0],
    });
  })
);

/**
 * Check an ONU is usable for a subscription: in scope, and not already bound to
 * a different live one.
 *
 * @returns {Promise<string|null>} an error message, or null when it is free
 */
const checkOnuAvailable = async (conn, req, onuId, excludeSubscriptionId = null) => {
  await findScopedRow(conn, req, {
    table: "onus",
    idColumn: "onuId",
    id: onuId,
    label: "ONU",
    statusColumn: "recordStatus",
    columns: "onuId, branchId, mac, serialNo",
  });

  const [taken] = await conn.execute(
    `SELECT subscriptionId FROM subscriptions
     WHERE onuId = ? AND status != 'terminated' AND recordStatus != 'Deleted'
       ${excludeSubscriptionId ? "AND subscriptionId != ?" : ""}
     LIMIT 1 FOR UPDATE`,
    excludeSubscriptionId ? [onuId, excludeSubscriptionId] : [onuId]
  );

  return taken.length > 0 ? "That ONU is already bound to another subscription" : null;
};

/**
 * POST /
 *
 * Always starts `pending`. Activation is a separate, deliberate act — creating
 * the paperwork and turning on the service are different events, and proration
 * reads the activation date, not this one.
 */
router.post(
  "/",
  checkPermission("subscriptions", null, "write"),
  validateBody(createSubscriptionSchema),
  catchAsync(async (req, res) => {
    const { customerId, planId, onuId, notes } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // The subscription lives in the customer's branch — the customer is who
      // the branch actually serves.
      const customer = await findScopedRow(conn, req, {
        table: "customers",
        idColumn: "customerId",
        id: customerId,
        label: "Customer",
        columns: "customerId, branchId, accountNo, name",
      });

      // Plans are company-wide (decision D3), so this is a company check only.
      const [planRows] = await conn.execute(
        `SELECT planId, name FROM plans
         WHERE planId = ? AND companyId = ? AND status = 'Active'
         LIMIT 1`,
        [planId, companyId]
      );

      if (planRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Plan not found or not active", 404);
      }

      if (onuId) {
        const clash = await checkOnuAvailable(conn, req, onuId);
        if (clash) {
          await req.db.rollback(conn);
          return res.sendError(clash, 409);
        }
      }

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const subscriptionId = uuidRow[0].id;

      const after = {
        subscriptionId,
        companyId,
        branchId: customer.branchId,
        customerId,
        planId,
        onuId: onuId || null,
        status: "pending",
        activatedAt: null,
      };

      await conn.execute(
        `INSERT INTO subscriptions
           (subscriptionId, companyId, branchId, customerId, planId, onuId, status,
            notes, recordStatus, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'Active', ?, ?)`,
        [
          subscriptionId,
          companyId,
          customer.branchId,
          customerId,
          planId,
          onuId || null,
          notes || null,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "subscriptions",
        action: "create",
        description: `Created subscription for ${customer.accountNo} — ${customer.name} on plan "${planRows[0].name}"`,
        after,
      });

      await req.db.commit(conn);
      return res.sendSuccess("Subscription created successfully", { subscriptionId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:subscriptionId
 *
 * Edits the binding — plan changes, seating a modem, notes. Refused once
 * terminated: a closed subscription is a historical record that invoices point
 * at, and editing it would rewrite the past.
 */
router.put(
  "/:subscriptionId",
  checkPermission("subscriptions", null, "write"),
  validateBody(updateSubscriptionSchema),
  catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;
    const { customerId, planId, onuId, notes } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedSubscription(conn, req, subscriptionId, {
        columns:
          "subscriptionId, branchId, customerId, planId, onuId, status, activatedAt, notes",
        forUpdate: true,
      });

      if (before.status === "terminated") {
        await req.db.rollback(conn);
        return res.sendError("A terminated subscription cannot be edited", 409);
      }

      const customer = await findScopedRow(conn, req, {
        table: "customers",
        idColumn: "customerId",
        id: customerId,
        label: "Customer",
        columns: "customerId, branchId",
      });

      const [planRows] = await conn.execute(
        `SELECT planId FROM plans WHERE planId = ? AND companyId = ? AND status = 'Active' LIMIT 1`,
        [planId, companyId]
      );

      if (planRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Plan not found or not active", 404);
      }

      if (onuId) {
        const clash = await checkOnuAvailable(conn, req, onuId, subscriptionId);
        if (clash) {
          await req.db.rollback(conn);
          return res.sendError(clash, 409);
        }
      } else if (before.onuId && before.status === "active") {
        // Detaching the modem from a live subscription would leave a service
        // nobody can suspend — the dunning worker resolves the OLT through it.
        await req.db.rollback(conn);
        return res.sendError(
          "An active subscription must keep its ONU. Terminate it first, or attach a different modem.",
          409
        );
      }

      const after = {
        ...before,
        customerId,
        branchId: customer.branchId,
        planId,
        onuId: onuId || null,
        notes: notes || null,
      };

      await conn.execute(
        `UPDATE subscriptions
         SET customerId = ?, branchId = ?, planId = ?, onuId = ?, notes = ?, dateUpdated = ?
         WHERE subscriptionId = ? AND companyId = ? AND recordStatus != 'Deleted'`,
        [
          customerId,
          customer.branchId,
          planId,
          onuId || null,
          notes || null,
          now,
          subscriptionId,
          companyId,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "subscriptions",
        action: "update",
        description:
          before.planId === planId
            ? "Updated subscription"
            : "Changed subscription plan — applies from the next billing cycle",
        before,
        after,
      });

      await req.db.commit(conn);
      return res.sendSuccess("Subscription updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * POST /:subscriptionId/status
 *
 * The staff-owned half of the lifecycle. Suspension and restoration are not
 * here — see the note at the top of this file.
 */
router.post(
  "/:subscriptionId/status",
  checkPermission("subscriptions", null, "write"),
  validateBody(transitionSchema),
  catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;
    const { action, reason } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedSubscription(conn, req, subscriptionId, {
        columns:
          "subscriptionId, customerId, planId, onuId, status, activatedAt, terminatedAt",
        forUpdate: true,
      });

      if (action === "activate") {
        if (before.status !== "pending") {
          await req.db.rollback(conn);
          return res.sendError(
            before.status === "suspended"
              ? "A suspended subscription is restored by payment, not by hand."
              : `Only a pending subscription can be activated (this one is '${before.status}')`,
            409
          );
        }

        if (!before.onuId) {
          await req.db.rollback(conn);
          return res.sendError(
            "Attach an ONU before activating — there is nothing to provide service through.",
            409
          );
        }

        await conn.execute(
          `UPDATE subscriptions
           SET status = 'active', activatedAt = ?, dateUpdated = ?
           WHERE subscriptionId = ? AND companyId = ?`,
          [now, now, subscriptionId, companyId]
        );

        await writeAudit(conn, {
          context: getAuditContext(req),
          module: "subscriptions",
          action: "activate",
          // Worth spelling out: this is what starts the meter running.
          description: "Activated subscription — billing begins from this date",
          before,
          after: { ...before, status: "active", activatedAt: now },
          meta: reason ? { reason } : null,
        });

        await req.db.commit(conn);
        return res.sendSuccess("Subscription activated", { status: "active" });
      }

      // action === "terminate"
      if (before.status === "terminated") {
        await req.db.rollback(conn);
        return res.sendError("This subscription is already terminated", 409);
      }

      // The ONU is released so it can be re-seated for someone else. The device
      // itself is NOT deprovisioned here — that is a worker job (S6) — so the
      // audit says as much rather than implying the modem went dark.
      await conn.execute(
        `UPDATE subscriptions
         SET status = 'terminated', terminatedAt = ?, onuId = NULL, dateUpdated = ?
         WHERE subscriptionId = ? AND companyId = ?`,
        [now, now, subscriptionId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "subscriptions",
        action: "terminate",
        description: before.onuId
          ? "Terminated subscription and released its ONU — the device still needs deprovisioning at the OLT"
          : "Terminated subscription",
        before,
        after: { ...before, status: "terminated", terminatedAt: now, onuId: null },
        meta: reason ? { reason } : null,
      });

      await req.db.commit(conn);
      return res.sendSuccess("Subscription terminated", { status: "terminated" });
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:subscriptionId — soft delete the RECORD.
 *
 * Only for a subscription that never went live: once it has been active it has
 * invoices pointing at it, and removing it from lists would hide history the
 * books depend on. Terminate those instead.
 */
router.delete(
  "/:subscriptionId",
  checkPermission("subscriptions", null, "write"),
  catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedSubscription(conn, req, subscriptionId, {
        columns: "subscriptionId, customerId, status, activatedAt, recordStatus",
        forUpdate: true,
      });

      if (before.activatedAt) {
        await req.db.rollback(conn);
        return res.sendError(
          "This subscription has been active and may have invoices against it. Terminate it instead of deleting.",
          409
        );
      }

      await conn.execute(
        `UPDATE subscriptions SET recordStatus = 'Deleted', onuId = NULL, dateUpdated = ?
         WHERE subscriptionId = ? AND companyId = ? AND recordStatus != 'Deleted'`,
        [now, subscriptionId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "subscriptions",
        action: "delete",
        description: "Deleted a subscription that was never activated",
        before,
        after: { ...before, recordStatus: "Deleted", onuId: null },
      });

      await req.db.commit(conn);
      return res.sendSuccess("Subscription deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
