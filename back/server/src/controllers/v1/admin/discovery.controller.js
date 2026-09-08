import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext } from "../../../utils/audit.js";
import { importDiscoveredItem, runDiscovery } from "../../../lib/discovery/discovery.service.js";
import {
  importItemSchema,
  listItemsQuerySchema,
  listRunsQuerySchema,
  runDiscoverySchema,
} from "../../../validators/discovery.validator.js";

const router = express.Router();

/**
 * Discovery — what the device says, next to what we think.
 *
 * ── A sweep changes nothing ─────────────────────────────────────────────────
 *
 * `POST /runs` reads an OLT and stages the comparison. It creates no ONU, no
 * customer, no subscription. Importing is a separate call, one item at a time,
 * with staff-confirmed values and an audit entry.
 *
 * That is not caution for its own sake. A sweep of a four-hundred-modem OLT
 * would otherwise create four hundred inventory records out of free text typed
 * by whoever installed them, and unpicking that is worse than typing it.
 */

/**
 * POST /runs — sweep one OLT.
 */
router.post(
  "/runs",
  checkPermission("network", "discovery", "write"),
  validateBody(runDiscoverySchema),
  catchAsync(async (req, res) => {
    const { companyId } = req.user;
    const scope = branchScope("branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT oltId, companyId, branchId, name, vendor, host, port, protocol,
              credentialsEnc, status
         FROM olts
        WHERE oltId = ? AND companyId = ?${scope.clause} AND status != 'Deleted'
        LIMIT 1`,
      [req.body.oltId, companyId, ...scope.params]
    );

    const olt = rows[0];
    if (!olt) return res.sendError("OLT not found", 404);

    if (olt.status === "Retired") {
      return res.sendError("This OLT is retired — there is nothing to sweep", 409);
    }

    const result = await runDiscovery(req.db, {
      olt,
      context: getAuditContext(req),
      triggeredBy: `user:${req.user.accountId}`,
    });

    return res.sendSuccess("Discovery sweep completed", { result }, 201);
  })
);

/**
 * GET /runs — the sweeps that have been done.
 *
 * Kept rather than overwritten, so "the modem was there in August and gone in
 * September" is answerable. That is the question asked when a customer says
 * their connection vanished.
 */
router.get(
  "/runs",
  checkPermission("network", "discovery", "read"),
  validateQuery(listRunsQuerySchema),
  catchAsync(async (req, res) => {
    const { page = 1, pageSize = 10, oltId, status } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("dr.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE dr.companyId = ?${scope.clause}`;

    if (oltId) {
      whereClause += " AND dr.oltId = ?";
      params.push(oltId);
    }
    if (status) {
      whereClause += " AND dr.status = ?";
      params.push(status);
    }

    const JOINS = `LEFT JOIN olts o ON o.oltId = dr.oltId
      LEFT JOIN branches b ON b.branchId = dr.branchId`;

    const [countRows, runs] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM discovery_runs dr ${JOINS} ${whereClause}`, params),
      req.db.query(
        `SELECT dr.discoveryRunId, dr.oltId, dr.branchId, dr.status,
                dr.matchedCount, dr.newCount, dr.orphanedCount, dr.error,
                dr.durationMs, dr.triggeredBy, dr.startedAt, dr.finishedAt,
                dr.dateCreated,
                o.name AS oltName, b.name AS branchName
           FROM discovery_runs dr ${JOINS} ${whereClause}
          ORDER BY dr.dateCreated DESC
          LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Discovery runs retrieved", {
      runs,
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
 * GET /runs/:discoveryRunId — one run, including the device's raw reply.
 *
 * The raw output is here for the same reason it is on a provisioning action: a
 * sweep that returned nothing is a mystery without it, and "the OLT answered
 * with this" is what settles whether the problem is ours or the device's.
 */
router.get(
  "/runs/:discoveryRunId",
  checkPermission("network", "discovery", "read"),
  catchAsync(async (req, res) => {
    const scope = branchScope("dr.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT dr.*, o.name AS oltName
         FROM discovery_runs dr
         LEFT JOIN olts o ON o.oltId = dr.oltId
        WHERE dr.discoveryRunId = ? AND dr.companyId = ?${scope.clause}
        LIMIT 1`,
      [req.params.discoveryRunId, req.user.companyId, ...scope.params]
    );

    if (rows.length === 0) return res.sendError("Discovery run not found", 404);

    return res.sendSuccess("Discovery run retrieved", { run: rows[0] });
  })
);

/**
 * GET /runs/:discoveryRunId/items — what the sweep found.
 */
router.get(
  "/runs/:discoveryRunId/items",
  checkPermission("network", "discovery", "read"),
  validateQuery(listItemsQuerySchema),
  catchAsync(async (req, res) => {
    const { page = 1, pageSize = 25, search = "", matchStatus, imported } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("di.branchId", getScopedBranchIds(req.user));
    const params = [req.params.discoveryRunId, companyId, ...scope.params];
    let whereClause = `WHERE di.discoveryRunId = ? AND di.companyId = ?${scope.clause}`;

    if (matchStatus) {
      whereClause += " AND di.matchStatus = ?";
      params.push(matchStatus);
    }
    if (imported === "yes") whereClause += " AND di.importedAt IS NOT NULL";
    if (imported === "no") whereClause += " AND di.importedAt IS NULL";

    if (search) {
      // The raw JSON is searched too, so a technician can find a modem by the
      // customer name the previous operator typed into its description.
      whereClause += " AND (di.externalKey LIKE ? OR CAST(di.raw AS CHAR) LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows, items] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM discovered_items di ${whereClause}`, params),
      req.db.query(
        `SELECT di.discoveredItemId, di.discoveryRunId, di.source, di.externalKey,
                di.matchStatus, di.matchedEntity, di.matchedId, di.raw, di.suggested,
                di.importedAt, di.importedBy, di.dateCreated
           FROM discovered_items di ${whereClause}
          ORDER BY FIELD(di.matchStatus, 'new', 'orphaned', 'matched'), di.externalKey
          LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Discovered items retrieved", {
      items,
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
 * POST /items/:discoveredItemId/import — turn one staged item into a real ONU.
 */
router.post(
  "/items/:discoveredItemId/import",
  checkPermission("network", "discovery", "write"),
  validateBody(importItemSchema),
  catchAsync(async (req, res) => {
    const { companyId, accountId } = req.user;
    const scope = branchScope("di.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT di.*, dr.oltId AS runOltId
         FROM discovered_items di
         JOIN discovery_runs dr ON dr.discoveryRunId = di.discoveryRunId
        WHERE di.discoveredItemId = ? AND di.companyId = ?${scope.clause}
        LIMIT 1`,
      [req.params.discoveredItemId, companyId, ...scope.params]
    );

    const item = rows[0];
    if (!item) return res.sendError("Discovered item not found", 404);

    const result = await importDiscoveredItem(req.db, {
      item,
      overrides: req.body,
      context: getAuditContext(req),
      accountId,
    });

    return res.sendSuccess("Imported into the network inventory", result, 201);
  })
);

export default router;
