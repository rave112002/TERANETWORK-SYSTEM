import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { enqueue } from "../../../lib/jobs/jobs.queue.js";
import { findScopedRow } from "../../../lib/network/network.helpers.js";
import { getRecoveryAfterDays } from "../../../lib/settings/settings.service.js";
import {
  findAwaitingPullOut,
  findRecoveryCandidates,
} from "../../../lib/recovery/recovery.service.js";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  transitionSchema,
  listSubscriptionsQuerySchema,
  recoveryQuerySchema,
} from "../../../validators/subscriptions.validator.js";

const router = express.Router();

/**
 * Subscriptions — what makes a customer billable.
 *
 * ── The lifecycle, and who owns each edge ───────────────────────────────────
 *
 *   pending      → active         staff, POST /:id/status { action: 'activate' }
 *   active       → suspended      the DUNNING WORKER, after the OLT confirms the cut
 *   suspended    → active         the PAYMENT PATH, after the OLT confirms restore
 *   suspended    → for_recovery   staff, { action: 'revoke' }
 *   for_recovery → suspended      staff, { action: 'unrevoke' } — a correction
 *   for_recovery → terminated     staff, { action: 'close', outcome }
 *   any          → terminated     staff, { action: 'terminate' }
 *
 * Only the staff edges live here. Suspension and restoration mirror what the
 * device is actually doing and are written by the worker in the same
 * transaction as the ONU's state — if this controller could set them, the
 * system would bill on a belief the hardware does not share, and the dunning
 * sweep reads exactly this column to decide who to cut off.
 *
 * ── What 'for_recovery' means, and what it costs to get wrong ───────────────
 *
 * The customer has been cut off for the configured number of days (60 by the
 * client's rule) and the business has given up on them. The modem is still on
 * their wall and the NAP port is still theirs; a technician has to go and get
 * it back. Screen label: **For pull-out**.
 *
 * Revoking is not suspending harder. It is the end of the relationship:
 *
 *   - paying no longer restores service, at any amount
 *   - coming back is a NEW subscription, with a new installation fee
 *   - the debt survives, so the account still appears in aging
 *
 * That last consequence is why this is a staff decision and not a timer, and
 * why `unrevoke` exists — a revocation made by mistake has to be undoable
 * without charging somebody a second installation for a clerical error.
 */

const SUBSCRIPTION_COLUMNS = `s.subscriptionId, s.companyId, s.branchId, s.customerId,
  s.planId, s.onuId, s.status, s.activatedAt, s.suspendedAt, s.forRecoveryAt,
  s.recoveryOutcome, s.terminatedAt, s.notes,
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
 * GET /recovery/candidates — accounts cut off long enough to consider giving up on.
 *
 * Registered before `/:subscriptionId` on purpose: Express matches in order, and
 * a route parameter declared first would swallow "recovery" as a subscription
 * id and answer 404 for a page that exists.
 *
 * Read-only. Nothing here revokes anything; the list is for a person.
 */
router.get(
  "/recovery/candidates",
  checkPermission("subscriptions", null, "read"),
  validateQuery(recoveryQuerySchema),
  catchAsync(async (req, res) => {
    const { search = "" } = req.query;
    const { companyId } = req.user;

    const recoveryAfterDays = await getRecoveryAfterDays(req.db, companyId);
    const result = await findRecoveryCandidates(req.db, {
      companyId,
      branchIds: getScopedBranchIds(req.user),
      recoveryAfterDays,
      search,
    });

    return res.sendSuccess("Recovery candidates retrieved", result);
  })
);

/**
 * GET /recovery/pending — modems already marked for pull-out, still uncollected.
 *
 * The technician's outstanding work, oldest first.
 */
router.get(
  "/recovery/pending",
  checkPermission("subscriptions", null, "read"),
  validateQuery(recoveryQuerySchema),
  catchAsync(async (req, res) => {
    const { search = "" } = req.query;
    const { companyId } = req.user;

    const pending = await findAwaitingPullOut(req.db, {
      companyId,
      branchIds: getScopedBranchIds(req.user),
      search,
    });

    return res.sendSuccess("Pending pull-outs retrieved", { pending });
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
    const { action, reason, outcome } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedSubscription(conn, req, subscriptionId, {
        columns:
          "subscriptionId, companyId, branchId, customerId, planId, onuId, status, " +
          "activatedAt, suspendedAt, forRecoveryAt, recoveryOutcome, terminatedAt",
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

      if (action === "revoke") {
        // Only from 'suspended'. Not from 'active' — an account with working
        // service is not somebody the business has given up on, whatever the
        // arrears look like, and reaching this from 'active' would mean nobody
        // ever cut them off, which is a different problem.
        if (before.status !== "suspended") {
          await req.db.rollback(conn);
          return res.sendError(
            `Only a suspended account can be marked for pull-out (this one is '${before.status}')`,
            409
          );
        }

        await conn.execute(
          `UPDATE subscriptions
           SET status = 'for_recovery', forRecoveryAt = ?, dateUpdated = ?
           WHERE subscriptionId = ? AND companyId = ?`,
          [now, now, subscriptionId, companyId]
        );

        await writeAudit(conn, {
          context: getAuditContext(req),
          module: "subscriptions",
          action: "revoke",
          // Spelled out because this is the entry somebody reads when a former
          // customer rings up asking why paying did not switch them back on.
          description:
            "Marked for pull-out — the account is revoked, payment no longer restores " +
            "service, and coming back means a new subscription and a new installation fee",
          before,
          after: { ...before, status: "for_recovery", forRecoveryAt: now },
          meta: reason ? { reason } : null,
        });

        await req.db.commit(conn);
        return res.sendSuccess("Marked for pull-out", { status: "for_recovery" });
      }

      if (action === "unrevoke") {
        // For a revocation made in error. Deliberately NOT a way back for a
        // customer who has decided to pay: it returns them to 'suspended', and
        // service still only comes back the usual way, through the device.
        if (before.status !== "for_recovery") {
          await req.db.rollback(conn);
          return res.sendError(
            `Only an account marked for pull-out can be un-marked (this one is '${before.status}')`,
            409
          );
        }

        await conn.execute(
          `UPDATE subscriptions
           SET status = 'suspended', forRecoveryAt = NULL, dateUpdated = ?
           WHERE subscriptionId = ? AND companyId = ?`,
          [now, subscriptionId, companyId]
        );

        await writeAudit(conn, {
          context: getAuditContext(req),
          module: "subscriptions",
          action: "unrevoke",
          description:
            "Cancelled the pull-out — the account is suspended again. Service still " +
            "returns only when the balance is settled.",
          before,
          after: { ...before, status: "suspended", forRecoveryAt: null },
          meta: reason ? { reason } : null,
        });

        await req.db.commit(conn);
        return res.sendSuccess("Pull-out cancelled", { status: "suspended" });
      }

      if (action === "close") {
        if (before.status !== "for_recovery") {
          await req.db.rollback(conn);
          return res.sendError(
            `Only an account marked for pull-out can be closed this way (this one is ` +
              `'${before.status}'). Use 'terminate' for a customer who is leaving normally.`,
            409
          );
        }

        const recovered = outcome === "recovered";
        let onu = null;

        if (before.onuId) {
          const [onuRows] = await conn.execute(
            `SELECT onuId, mac, serialNo, oltId, napId, napPort, provisioningState
               FROM onus WHERE onuId = ? FOR UPDATE`,
            [before.onuId]
          );
          onu = onuRows[0] ?? null;
        }

        await conn.execute(
          `UPDATE subscriptions
           SET status = 'terminated', terminatedAt = ?, recoveryOutcome = ?,
               onuId = NULL, dateUpdated = ?
           WHERE subscriptionId = ? AND companyId = ?`,
          [now, outcome, now, subscriptionId, companyId]
        );

        let unblacklistQueued = false;

        if (onu) {
          // ── The NAP port is released either way ───────────────────────
          //
          // Whether or not the unit came back, nothing of ours is serving that
          // address any more, and the port has to be available for the next
          // install. Holding it because a technician could not retrieve a modem
          // would slowly starve a NAP of ports for no benefit.
          //
          // ── What differs is where the modem goes ──────────────────────
          //
          //   recovered      back to stock: unprovisioned, and un-blacklisted at
          //                  the OLT so it actually works when next seated
          //   not_recovered  written off: the record is kept for its history and
          //                  the MAC STAYS blacklisted, because the unit is on
          //                  somebody's shelf and must not be usable
          if (recovered) {
            await conn.execute(
              `UPDATE onus
                 SET napId = NULL, napPort = NULL, provisioningState = 'unprovisioned',
                     recordStatus = 'Active', dateUpdated = ?
               WHERE onuId = ?`,
              [now, onu.onuId]
            );

            // A modem left blacklisted is a brick the next time a technician
            // seats it, months from now, with nothing to explain why. Queued
            // rather than sent here: nothing in a request handler talks to a
            // device.
            if (onu.oltId && onu.mac) {
              const { deduped } = await enqueue(conn, {
                companyId,
                branchId: before.branchId,
                type: "activate",
                payload: {
                  onuId: onu.onuId,
                  reason: "recovery",
                  triggeredBy: `user:${req.user.accountId}`,
                },
                dedupeKey: `activate:recovery:${onu.onuId}`,
              });
              unblacklistQueued = !deduped;
            }
          } else {
            await conn.execute(
              `UPDATE onus
                 SET napId = NULL, napPort = NULL, recordStatus = 'Inactive',
                     dateUpdated = ?
               WHERE onuId = ?`,
              [now, onu.onuId]
            );
          }
        }

        const modem = onu?.mac || onu?.serialNo || "(none on record)";

        await writeAudit(conn, {
          context: getAuditContext(req),
          module: "subscriptions",
          action: "recovery.close",
          description: recovered
            ? `Closed the account — modem ${modem} recovered and returned to stock, ` +
              `NAP port released`
            : `Closed the account — modem ${modem} was NOT recovered. It stays ` +
              `blacklisted at the OLT and is written off; the NAP port is released.`,
          before,
          after: {
            ...before,
            status: "terminated",
            terminatedAt: now,
            recoveryOutcome: outcome,
            onuId: null,
          },
          meta: reason ? { reason, outcome } : { outcome },
        });

        await req.db.commit(conn);
        return res.sendSuccess("Account closed", {
          status: "terminated",
          outcome,
          unblacklistQueued,
        });
      }

      // action === "terminate"
      if (before.status === "for_recovery") {
        await req.db.rollback(conn);
        return res.sendError(
          "This account is awaiting modem pull-out. Close it with the recovery outcome " +
            "instead, so the modem is either returned to stock or written off.",
          409
        );
      }

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
