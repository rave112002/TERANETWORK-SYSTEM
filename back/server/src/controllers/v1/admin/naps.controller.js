import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { findScopedNap, findScopedSplitter } from "../../../lib/network/network.helpers.js";
import {
  createNapSchema,
  updateNapSchema,
  listNapsQuerySchema,
} from "../../../validators/network.validator.js";

const router = express.Router();

/**
 * NAPs (also FAT/FDB) — the field boxes where subscriber drop cables terminate.
 *
 * GPS is required on every row, because the whole point of the record is that a
 * technician can find the box. `usedPorts` vs `totalPorts` is the number staff
 * work from when deciding where the next subscriber can be connected.
 */

const NAP_COLUMNS = `n.napId, n.companyId, n.branchId, n.splitterId, n.label, n.totalPorts,
  n.gpsLat, n.gpsLng, n.address, n.notes, n.status, n.dateCreated, n.dateUpdated`;

const USED_PORTS = `(SELECT COUNT(*) FROM onus u
   WHERE u.napId = n.napId AND u.recordStatus != 'Deleted')`;

/**
 * GET /
 *
 * Set `pageSize` high and read `gpsLat`/`gpsLng` to drive the map — this is the
 * same endpoint the map view uses, so there is one definition of what a
 * technician may see.
 */
router.get(
  "/",
  checkPermission("network", "naps", "read"),
  validateQuery(listNapsQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      branchId,
      splitterId,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("n.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE n.companyId = ?${scope.clause}`;

    if (branchId) {
      whereClause += " AND n.branchId = ?";
      params.push(branchId);
    }
    if (splitterId) {
      whereClause += " AND n.splitterId = ?";
      params.push(splitterId);
    }

    if (status) {
      whereClause += " AND n.status = ?";
      params.push(status);
    } else {
      whereClause += " AND n.status != 'Deleted'";
    }

    if (search) {
      whereClause += " AND (n.label LIKE ? OR n.address LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "label"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, naps] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM naps n ${whereClause}`, params),
      req.db.query(
        `SELECT ${NAP_COLUMNS}, s.label AS splitterLabel, s.ratio AS splitterRatio,
                ${USED_PORTS} AS usedPorts
         FROM naps n
         LEFT JOIN splitters s ON s.splitterId = n.splitterId
         ${whereClause}
         ORDER BY n.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("NAPs retrieved successfully", {
      naps,
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
 * GET /:napId
 */
router.get(
  "/:napId",
  checkPermission("network", "naps", "read"),
  catchAsync(async (req, res) => {
    const { napId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("n.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT ${NAP_COLUMNS}, s.label AS splitterLabel, s.ratio AS splitterRatio,
              ${USED_PORTS} AS usedPorts
       FROM naps n
       LEFT JOIN splitters s ON s.splitterId = n.splitterId
       WHERE n.napId = ? AND n.companyId = ?${scope.clause} AND n.status != 'Deleted'
       LIMIT 1`,
      [napId, companyId, ...scope.params]
    );

    if (rows.length === 0) {
      return res.sendError("NAP not found", 404);
    }

    return res.sendSuccess("NAP retrieved successfully", { nap: rows[0] });
  })
);

/**
 * POST /
 */
router.post(
  "/",
  checkPermission("network", "naps", "write"),
  validateBody(createNapSchema),
  catchAsync(async (req, res) => {
    const { splitterId, label, totalPorts, gpsLat, gpsLng, address, notes } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // 404s when the splitter is missing or in another branch. The NAP's
      // branch comes from it.
      const splitter = await findScopedSplitter(conn, req, splitterId, {
        columns: "splitterId, branchId, label",
      });

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const napId = uuidRow[0].id;

      await conn.execute(
        `INSERT INTO naps
           (napId, companyId, branchId, splitterId, label, totalPorts, gpsLat, gpsLng,
            address, notes, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [
          napId,
          companyId,
          splitter.branchId,
          splitterId,
          label,
          totalPorts,
          gpsLat,
          gpsLng,
          address || null,
          notes || null,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "nap.create",
        description: `Added NAP "${label}" (${totalPorts} ports) on splitter "${splitter.label}"`,
        after: {
          napId,
          branchId: splitter.branchId,
          splitterId,
          label,
          totalPorts,
          gpsLat,
          gpsLng,
          address,
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("NAP created successfully", { napId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:napId
 *
 * Shrinking `totalPorts` below the number of ONUs already connected is refused:
 * the count is what capacity planning reads, and a NAP that claims 8 ports
 * while 12 modems hang off it makes every downstream number wrong.
 */
router.put(
  "/:napId",
  checkPermission("network", "naps", "write"),
  validateBody(updateNapSchema),
  catchAsync(async (req, res) => {
    const { napId } = req.params;
    const { splitterId, label, totalPorts, gpsLat, gpsLng, address, notes, status } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedNap(conn, req, napId, {
        columns:
          "napId, branchId, splitterId, label, totalPorts, gpsLat, gpsLng, address, notes, status",
        forUpdate: true,
      });

      const splitter = await findScopedSplitter(conn, req, splitterId, {
        columns: "splitterId, branchId",
      });

      // The blocker is the highest port number in use, not how many ONUs there
      // are: one modem on port 5 still makes a shrink to 2 ports impossible,
      // and counting alone would wave that through.
      const [used] = await conn.execute(
        `SELECT COUNT(*) AS total, COALESCE(MAX(napPort), 0) AS highestPort
         FROM onus WHERE napId = ? AND recordStatus != 'Deleted'`,
        [napId]
      );

      const { total: connectedOnus, highestPort } = used[0];

      if (highestPort > totalPorts) {
        await req.db.rollback(conn);
        return res.sendError(
          `An ONU is connected to port ${highestPort} — this NAP cannot be reduced to ${totalPorts} ports.`,
          409
        );
      }

      if (connectedOnus > totalPorts) {
        await req.db.rollback(conn);
        return res.sendError(
          `This NAP already has ${connectedOnus} ONU(s) connected — it cannot be reduced to ${totalPorts} ports.`,
          409
        );
      }

      await conn.execute(
        `UPDATE naps
         SET splitterId = ?, branchId = ?, label = ?, totalPorts = ?, gpsLat = ?, gpsLng = ?,
             address = ?, notes = ?, status = ?, dateUpdated = ?
         WHERE napId = ? AND companyId = ? AND status != 'Deleted'`,
        [
          splitterId,
          splitter.branchId,
          label,
          totalPorts,
          gpsLat,
          gpsLng,
          address || null,
          notes || null,
          status || "Active",
          now,
          napId,
          companyId,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "nap.update",
        description: `Updated NAP "${label}"`,
        before,
        after: {
          ...before,
          splitterId,
          branchId: splitter.branchId,
          label,
          totalPorts,
          gpsLat,
          gpsLng,
          address: address || null,
          notes: notes || null,
          status: status || "Active",
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("NAP updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:napId — soft delete. Refused while ONUs are still connected.
 */
router.delete(
  "/:napId",
  checkPermission("network", "naps", "write"),
  catchAsync(async (req, res) => {
    const { napId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedNap(conn, req, napId, {
        columns: "napId, label, totalPorts, status",
        forUpdate: true,
      });

      const [used] = await conn.execute(
        `SELECT COUNT(*) AS total FROM onus WHERE napId = ? AND recordStatus != 'Deleted'`,
        [napId]
      );

      if (used[0].total > 0) {
        await req.db.rollback(conn);
        return res.sendError(
          `This NAP still has ${used[0].total} ONU(s) connected. Disconnect them first.`,
          409
        );
      }

      await conn.execute(
        `UPDATE naps SET status = 'Deleted', dateUpdated = ?
         WHERE napId = ? AND companyId = ? AND status != 'Deleted'`,
        [now, napId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "nap.delete",
        description: `Deleted NAP "${before.label}"`,
        before,
        after: { ...before, status: "Deleted" },
      });

      await req.db.commit(conn);
      return res.sendSuccess("NAP deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
