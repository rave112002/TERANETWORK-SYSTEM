import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { findScopedOnu } from "../../../lib/network/network.helpers.js";
import { enqueue } from "../../../lib/jobs/jobs.queue.js";
import { isDryRun } from "../../../lib/settings/settings.service.js";
import {
  provisionActionSchema,
  listActionLogsQuerySchema,
} from "../../../validators/provisioning.validator.js";

const router = express.Router();

/**
 * Manual provisioning — suspend, restore, or read an ONU at the OLT.
 *
 * ── Nothing here talks to a device ──────────────────────────────────────────
 *
 * Every endpoint enqueues a job and returns **202 Accepted**. A telnet session
 * takes seconds and can hang; doing it in a request handler would tie up a
 * connection, time out the browser, and leave nobody knowing whether the
 * command landed. The worker owns every device conversation, which is also what
 * makes retries, backoff and the dry-run switch apply uniformly to manual
 * actions and automated ones alike.
 *
 * So the response means "queued", never "done" — and the UI must say so.
 */

/** The same key the dunning sweep uses and payment settlement cancels. */
const dedupeKeyFor = (action, onuId) => `${action}:onu:${onuId}`;

/**
 * POST /onus/:onuId/:action  (activate | deactivate | status)
 */
router.post(
  "/onus/:onuId/:action",
  checkPermission("network", "provisioning", "write"),
  validateBody(provisionActionSchema),
  catchAsync(async (req, res) => {
    const { onuId, action } = req.params;
    const { reason } = req.body;
    const { companyId, accountId } = req.user;

    if (!["activate", "deactivate", "status"].includes(action)) {
      return res.sendError(`Unknown action '${action}'`, 400);
    }

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const onu = await findScopedOnu(conn, req, onuId, {
        columns: "onuId, branchId, mac, serialNo, oltId, provisioningState",
      });

      if (!onu.oltId) {
        await req.db.rollback(conn);
        return res.sendError(
          "This ONU is not attached to an OLT, so there is nothing to send a command to.",
          409
        );
      }

      // A status read may legitimately repeat, so it carries no dedupe key.
      // Suspends and restores must not stack up.
      const dedupeKey = action === "status" ? null : dedupeKeyFor(action, onuId);

      const { jobId, deduped } = await enqueue(conn, {
        companyId,
        branchId: onu.branchId,
        type: action,
        dedupeKey,
        payload: {
          onuId,
          reason: reason || "manual",
          // Recorded on the action log so "who cut this customer off?" has a
          // name, not just "system".
          triggeredBy: `user:${accountId}`,
        },
      });

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: `provisioning.${action}`,
        description: deduped
          ? `A ${action} for ONU ${onu.mac || onu.serialNo} was already queued`
          : `Queued ${action} for ONU ${onu.mac || onu.serialNo}`,
        before: { provisioningState: onu.provisioningState },
        meta: { jobId, reason: reason || "manual", deduped },
      });

      await req.db.commit(conn);

      const dryRun = await isDryRun(req.db, companyId);

      return res.sendSuccess(
        deduped
          ? `A ${action} is already queued for this ONU`
          : dryRun
            ? `${action} queued — dry-run is ON, so the command will be logged, not sent`
            : `${action} queued`,
        {
          jobId,
          deduped,
          dryRun,
          // Says plainly that the work has not happened yet. A UI that reported
          // "disconnected" here would be claiming something no device has
          // confirmed.
          status: "queued",
        },
        202
      );
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * GET /onus/:onuId/action-logs
 *
 * The device black box for one modem: every command sent, the verbatim reply,
 * and whether it worked.
 */
router.get(
  "/onus/:onuId/action-logs",
  checkPermission("network", "action_logs", "read"),
  validateQuery(listActionLogsQuerySchema),
  catchAsync(async (req, res) => {
    const { onuId } = req.params;
    const { page = 1, pageSize = 20, action } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("l.branchId", getScopedBranchIds(req.user));
    const params = [onuId, companyId, ...scope.params];
    let whereClause = `WHERE l.onuId = ? AND l.companyId = ?${scope.clause}`;

    if (action) {
      whereClause += " AND l.action = ?";
      params.push(action);
    }

    const [countRows, logs] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM network_action_logs l ${whereClause}`, params),
      req.db.query(
        `SELECT l.actionLogId, l.onuId, l.oltId, l.action, l.triggeredBy, l.jobId,
                l.command, l.deviceResponse, l.success, l.error, l.durationMs,
                l.dateCreated, o.name AS oltName
         FROM network_action_logs l
         LEFT JOIN olts o ON o.oltId = l.oltId
         ${whereClause}
         ORDER BY l.dateCreated DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Action logs retrieved successfully", {
      logs,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

export default router;
