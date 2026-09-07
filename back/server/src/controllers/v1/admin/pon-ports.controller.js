import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { findScopedOlt, findScopedPonPort } from "../../../lib/network/network.helpers.js";
import {
  createPonPortSchema,
  updatePonPortSchema,
  listPonPortsQuerySchema,
} from "../../../validators/network.validator.js";

const router = express.Router();

/**
 * PON ports — the OLT ports that each feed a tree of subscribers.
 *
 * A port's branch is inherited from its OLT, never taken from the client:
 * attaching a port to an OLT is what decides where it lives.
 */

const PON_COLUMNS = `p.ponPortId, p.companyId, p.branchId, p.oltId, p.portIndex,
  p.capacity, p.description, p.status, p.dateCreated, p.dateUpdated`;

/**
 * GET /
 * List PON ports, optionally narrowed to one OLT.
 */
router.get(
  "/",
  checkPermission("network", "pon_ports", "read"),
  validateQuery(listPonPortsQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      branchId,
      oltId,
      sortBy = "dateCreated",
      sortOrder = "DESC",
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
    if (oltId) {
      whereClause += " AND p.oltId = ?";
      params.push(oltId);
    }

    if (status) {
      whereClause += " AND p.status = ?";
      params.push(status);
    } else {
      whereClause += " AND p.status != 'Deleted'";
    }

    if (search) {
      whereClause += " AND (p.portIndex LIKE ? OR p.description LIKE ? OR o.name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "portIndex"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, ponPorts] = await Promise.all([
      req.db.query(
        `SELECT COUNT(*) as total FROM pon_ports p
         LEFT JOIN olts o ON o.oltId = p.oltId
         ${whereClause}`,
        params
      ),
      req.db.query(
        // `usedPorts` is what staff actually look at — where is there room to
        // provision the next subscriber.
        `SELECT ${PON_COLUMNS}, o.name AS oltName, o.vendor AS oltVendor,
                (SELECT COUNT(*) FROM onus u
                  WHERE u.ponPortId = p.ponPortId AND u.recordStatus != 'Deleted') AS usedPorts
         FROM pon_ports p
         LEFT JOIN olts o ON o.oltId = p.oltId
         ${whereClause}
         ORDER BY p.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("PON ports retrieved successfully", {
      ponPorts,
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
 * GET /:ponPortId
 */
router.get(
  "/:ponPortId",
  checkPermission("network", "pon_ports", "read"),
  catchAsync(async (req, res) => {
    const { ponPortId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("p.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT ${PON_COLUMNS}, o.name AS oltName, o.vendor AS oltVendor
       FROM pon_ports p
       LEFT JOIN olts o ON o.oltId = p.oltId
       WHERE p.ponPortId = ? AND p.companyId = ?${scope.clause} AND p.status != 'Deleted'
       LIMIT 1`,
      [ponPortId, companyId, ...scope.params]
    );

    if (rows.length === 0) {
      return res.sendError("PON port not found", 404);
    }

    return res.sendSuccess("PON port retrieved successfully", { ponPort: rows[0] });
  })
);

/**
 * POST /
 */
router.post(
  "/",
  checkPermission("network", "pon_ports", "write"),
  validateBody(createPonPortSchema),
  catchAsync(async (req, res) => {
    const { oltId, portIndex, capacity, description } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Throws 404 when the OLT is missing or in another branch, so a port can
      // never be grafted onto a device the caller cannot see.
      const olt = await findScopedOlt(conn, req, oltId, { columns: "oltId, branchId, name" });

      const [existing] = await conn.execute(
        `SELECT ponPortId FROM pon_ports
         WHERE oltId = ? AND portIndex = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [oltId, portIndex]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError(`Port ${portIndex} already exists on this OLT`, 409);
      }

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const ponPortId = uuidRow[0].id;

      await conn.execute(
        `INSERT INTO pon_ports
           (ponPortId, companyId, branchId, oltId, portIndex, capacity, description,
            status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [
          ponPortId,
          companyId,
          olt.branchId,
          oltId,
          portIndex,
          capacity,
          description || null,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "pon_port.create",
        description: `Added PON port ${portIndex} on OLT "${olt.name}"`,
        after: { ponPortId, oltId, branchId: olt.branchId, portIndex, capacity, description },
      });

      await req.db.commit(conn);
      return res.sendSuccess("PON port created successfully", { ponPortId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:ponPortId
 *
 * `oltId` is not editable: moving a port to another OLT would silently
 * re-parent every splitter, NAP and ONU beneath it.
 */
router.put(
  "/:ponPortId",
  checkPermission("network", "pon_ports", "write"),
  validateBody(updatePonPortSchema),
  catchAsync(async (req, res) => {
    const { ponPortId } = req.params;
    const { portIndex, capacity, description, status } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedPonPort(conn, req, ponPortId, {
        columns: "ponPortId, oltId, portIndex, capacity, description, status",
        forUpdate: true,
      });

      if (portIndex !== before.portIndex) {
        const [clash] = await conn.execute(
          `SELECT ponPortId FROM pon_ports
           WHERE oltId = ? AND portIndex = ? AND ponPortId != ? AND status != 'Deleted'
           LIMIT 1 FOR UPDATE`,
          [before.oltId, portIndex, ponPortId]
        );

        if (clash.length > 0) {
          await req.db.rollback(conn);
          return res.sendError(`Port ${portIndex} already exists on this OLT`, 409);
        }
      }

      await conn.execute(
        `UPDATE pon_ports
         SET portIndex = ?, capacity = ?, description = ?, status = ?, dateUpdated = ?
         WHERE ponPortId = ? AND companyId = ? AND status != 'Deleted'`,
        [portIndex, capacity, description || null, status || "Active", now, ponPortId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "pon_port.update",
        description: `Updated PON port ${portIndex}`,
        before,
        after: {
          ...before,
          portIndex,
          capacity,
          description: description || null,
          status: status || "Active",
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("PON port updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:ponPortId — soft delete.
 *
 * Refused while splitters still hang off it, or while ONUs still point at it.
 */
router.delete(
  "/:ponPortId",
  checkPermission("network", "pon_ports", "write"),
  catchAsync(async (req, res) => {
    const { ponPortId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedPonPort(conn, req, ponPortId, {
        columns: "ponPortId, oltId, portIndex, status",
        forUpdate: true,
      });

      const [children] = await conn.execute(
        `SELECT
           (SELECT COUNT(*) FROM splitters s
             WHERE s.parentType = 'pon_port' AND s.parentId = ? AND s.status != 'Deleted') AS splitters,
           (SELECT COUNT(*) FROM onus u
             WHERE u.ponPortId = ? AND u.recordStatus != 'Deleted') AS onus`,
        [ponPortId, ponPortId]
      );

      const { splitters, onus } = children[0];
      if (splitters > 0 || onus > 0) {
        await req.db.rollback(conn);
        return res.sendError(
          `This port still carries ${splitters} splitter(s) and ${onus} ONU(s). Remove them first.`,
          409
        );
      }

      await conn.execute(
        `UPDATE pon_ports SET status = 'Deleted', dateUpdated = ?
         WHERE ponPortId = ? AND companyId = ? AND status != 'Deleted'`,
        [now, ponPortId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "pon_port.delete",
        description: `Deleted PON port ${before.portIndex}`,
        before,
        after: { ...before, status: "Deleted" },
      });

      await req.db.commit(conn);
      return res.sendSuccess("PON port deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
