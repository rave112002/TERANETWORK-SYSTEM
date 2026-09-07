import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import {
  assertBranchInScope,
  branchScope,
  getScopedBranchIds,
} from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { findScopedNap, findScopedOnu, resolveOnuTopology } from "../../../lib/network/network.helpers.js";
import {
  createOnuSchema,
  updateOnuSchema,
  listOnusQuerySchema,
} from "../../../validators/network.validator.js";

const router = express.Router();

/**
 * ONUs — subscriber modems.
 *
 * ── The one rule that matters most in this file ─────────────────────────────
 *
 * `provisioningState` is NOT editable here. It is owned by the provisioning
 * worker (S6) and only ever moves to `active`/`suspended` after a confirmed
 * device response, in the same transaction as the network action log. If staff
 * could set it by hand, the database would start claiming a customer is
 * connected when the OLT says otherwise — and the dunning engine reads this
 * column to decide who to cut off.
 *
 * Inventory state lives in `recordStatus` instead, which staff do control.
 *
 * ── Topology is derived, never supplied ─────────────────────────────────────
 *
 * `oltId` and `ponPortId` are denormalised copies used by the worker to resolve
 * ONU → driver in one query. They are computed from the NAP's splitter chain,
 * so a client cannot point a modem at the wrong device.
 */

const ONU_COLUMNS = `u.onuId, u.companyId, u.branchId, u.serialNo, u.mac, u.model,
  u.napId, u.napPort, u.oltId, u.ponPortId, u.onuIndex, u.provisioningState,
  u.lastRxDbm, u.lastTxDbm, u.lastSeenAt, u.description, u.notes,
  u.recordStatus, u.dateCreated, u.dateUpdated`;

/**
 * GET /
 */
router.get(
  "/",
  checkPermission("network", "onus", "read"),
  validateQuery(listOnusQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      recordStatus,
      provisioningState,
      branchId,
      oltId,
      napId,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("u.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE u.companyId = ?${scope.clause}`;

    if (branchId) {
      whereClause += " AND u.branchId = ?";
      params.push(branchId);
    }
    if (oltId) {
      whereClause += " AND u.oltId = ?";
      params.push(oltId);
    }
    if (napId) {
      whereClause += " AND u.napId = ?";
      params.push(napId);
    }
    if (provisioningState) {
      whereClause += " AND u.provisioningState = ?";
      params.push(provisioningState);
    }

    if (recordStatus) {
      whereClause += " AND u.recordStatus = ?";
      params.push(recordStatus);
    } else {
      whereClause += " AND u.recordStatus != 'Deleted'";
    }

    if (search) {
      whereClause +=
        " AND (u.serialNo LIKE ? OR u.mac LIKE ? OR u.model LIKE ? OR u.description LIKE ? OR u.onuIndex LIKE ?)";
      params.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
    }

    const allowedSortColumns = [
      "dateCreated",
      "dateUpdated",
      "serialNo",
      "mac",
      "provisioningState",
    ];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, onus] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM onus u ${whereClause}`, params),
      req.db.query(
        `SELECT ${ONU_COLUMNS}, n.label AS napLabel, o.name AS oltName, b.name AS branchName
         FROM onus u
         LEFT JOIN naps n ON n.napId = u.napId
         LEFT JOIN olts o ON o.oltId = u.oltId
         LEFT JOIN branches b ON b.branchId = u.branchId
         ${whereClause}
         ORDER BY u.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("ONUs retrieved successfully", {
      onus,
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
 * GET /:onuId
 */
router.get(
  "/:onuId",
  checkPermission("network", "onus", "read"),
  catchAsync(async (req, res) => {
    const { onuId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("u.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT ${ONU_COLUMNS}, n.label AS napLabel, o.name AS oltName, b.name AS branchName
       FROM onus u
       LEFT JOIN naps n ON n.napId = u.napId
       LEFT JOIN olts o ON o.oltId = u.oltId
       LEFT JOIN branches b ON b.branchId = u.branchId
       WHERE u.onuId = ? AND u.companyId = ?${scope.clause} AND u.recordStatus != 'Deleted'
       LIMIT 1`,
      [onuId, companyId, ...scope.params]
    );

    if (rows.length === 0) {
      return res.sendError("ONU not found", 404);
    }

    return res.sendSuccess("ONU retrieved successfully", { onu: rows[0] });
  })
);

/**
 * Reject a serial or MAC already used by another live ONU in the same company.
 *
 * On EPON the MAC *is* the ONU's identity and the join key against MikroTik
 * sessions, so a duplicate would make device discovery match the wrong record.
 *
 * @returns {Promise<string|null>} an error message, or null when clear
 */
const findIdentifierClash = async (conn, companyId, { serialNo, mac, excludeOnuId = null }) => {
  const checks = [
    serialNo ? { column: "serialNo", value: serialNo, label: "serial number" } : null,
    mac ? { column: "mac", value: mac, label: "MAC address" } : null,
  ].filter(Boolean);

  for (const { column, value, label } of checks) {
    const [rows] = await conn.execute(
      `SELECT onuId FROM onus
       WHERE ${column} = ? AND companyId = ? AND recordStatus != 'Deleted'
         ${excludeOnuId ? "AND onuId != ?" : ""}
       LIMIT 1 FOR UPDATE`,
      excludeOnuId ? [value, companyId, excludeOnuId] : [value, companyId]
    );
    if (rows.length > 0) return `Another ONU already uses this ${label}`;
  }

  return null;
};

/**
 * POST /
 *
 * A new ONU starts `unprovisioned`: it is inventory until the worker confirms
 * the device is actually up.
 */
router.post(
  "/",
  checkPermission("network", "onus", "write"),
  validateBody(createOnuSchema),
  catchAsync(async (req, res) => {
    const {
      serialNo,
      mac,
      model,
      napId,
      napPort,
      onuIndex,
      description,
      notes,
      branchId,
    } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Where the ONU sits, and therefore which OLT the worker will talk to.
      // Derived from the NAP; never taken from the request.
      let topology = { branchId: branchId || req.user.branchId, oltId: null, ponPortId: null };
      if (napId) {
        topology = await resolveOnuTopology(conn, req, napId);
      } else {
        assertBranchInScope(req.user, topology.branchId);
      }

      const clash = await findIdentifierClash(conn, companyId, { serialNo, mac });
      if (clash) {
        await req.db.rollback(conn);
        return res.sendError(clash, 409);
      }

      if (napId && napPort) {
        const nap = await findScopedNap(conn, req, napId, { columns: "napId, label, totalPorts" });

        if (napPort > nap.totalPorts) {
          await req.db.rollback(conn);
          return res.sendError(
            `NAP "${nap.label}" only has ${nap.totalPorts} ports`,
            409
          );
        }

        const [taken] = await conn.execute(
          `SELECT onuId FROM onus
           WHERE napId = ? AND napPort = ? AND recordStatus != 'Deleted'
           LIMIT 1 FOR UPDATE`,
          [napId, napPort]
        );

        if (taken.length > 0) {
          await req.db.rollback(conn);
          return res.sendError(`Port ${napPort} on this NAP is already in use`, 409);
        }
      }

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const onuId = uuidRow[0].id;

      await conn.execute(
        `INSERT INTO onus
           (onuId, companyId, branchId, serialNo, mac, model, napId, napPort, oltId,
            ponPortId, onuIndex, provisioningState, description, notes, recordStatus,
            dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unprovisioned', ?, ?, 'Active', ?, ?)`,
        [
          onuId,
          companyId,
          topology.branchId,
          serialNo || null,
          mac || null,
          model || null,
          napId || null,
          napPort || null,
          topology.oltId,
          topology.ponPortId,
          onuIndex || null,
          description || null,
          notes || null,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "onu.create",
        description: `Added ONU ${mac || serialNo}`,
        after: {
          onuId,
          branchId: topology.branchId,
          serialNo,
          mac,
          model,
          napId,
          napPort,
          oltId: topology.oltId,
          ponPortId: topology.ponPortId,
          onuIndex,
          provisioningState: "unprovisioned",
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("ONU created successfully", { onuId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:onuId
 *
 * Moving an ONU to a different NAP re-derives its OLT and PON port, so the
 * worker's shortcut stays true. `provisioningState` is untouched — see the note
 * at the top of this file.
 */
router.put(
  "/:onuId",
  checkPermission("network", "onus", "write"),
  validateBody(updateOnuSchema),
  catchAsync(async (req, res) => {
    const { onuId } = req.params;
    const {
      serialNo,
      mac,
      model,
      napId,
      napPort,
      onuIndex,
      description,
      notes,
      recordStatus,
    } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedOnu(conn, req, onuId, {
        columns: `onuId, branchId, serialNo, mac, model, napId, napPort, oltId, ponPortId,
                  onuIndex, provisioningState, description, notes, recordStatus`,
        forUpdate: true,
      });

      const clash = await findIdentifierClash(conn, companyId, {
        serialNo,
        mac,
        excludeOnuId: onuId,
      });
      if (clash) {
        await req.db.rollback(conn);
        return res.sendError(clash, 409);
      }

      let topology = {
        branchId: before.branchId,
        oltId: before.oltId,
        ponPortId: before.ponPortId,
      };

      if (napId) {
        topology = await resolveOnuTopology(conn, req, napId);

        if (napPort) {
          const nap = await findScopedNap(conn, req, napId, {
            columns: "napId, label, totalPorts",
          });

          if (napPort > nap.totalPorts) {
            await req.db.rollback(conn);
            return res.sendError(`NAP "${nap.label}" only has ${nap.totalPorts} ports`, 409);
          }

          const [taken] = await conn.execute(
            `SELECT onuId FROM onus
             WHERE napId = ? AND napPort = ? AND onuId != ? AND recordStatus != 'Deleted'
             LIMIT 1 FOR UPDATE`,
            [napId, napPort, onuId]
          );

          if (taken.length > 0) {
            await req.db.rollback(conn);
            return res.sendError(`Port ${napPort} on this NAP is already in use`, 409);
          }
        }
      } else {
        // Detached from its NAP — it is inventory again, and nothing can be
        // provisioned through it until it is re-seated.
        topology = { branchId: before.branchId, oltId: null, ponPortId: null };
      }

      await conn.execute(
        `UPDATE onus
         SET serialNo = ?, mac = ?, model = ?, napId = ?, napPort = ?, oltId = ?,
             ponPortId = ?, onuIndex = ?, description = ?, notes = ?, branchId = ?,
             recordStatus = ?, dateUpdated = ?
         WHERE onuId = ? AND companyId = ? AND recordStatus != 'Deleted'`,
        [
          serialNo || null,
          mac || null,
          model || null,
          napId || null,
          napPort || null,
          topology.oltId,
          topology.ponPortId,
          onuIndex || null,
          description || null,
          notes || null,
          topology.branchId,
          recordStatus || "Active",
          now,
          onuId,
          companyId,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "onu.update",
        description: `Updated ONU ${mac || serialNo}`,
        before,
        after: {
          ...before,
          serialNo,
          mac,
          model,
          napId: napId || null,
          napPort: napPort || null,
          oltId: topology.oltId,
          ponPortId: topology.ponPortId,
          onuIndex,
          branchId: topology.branchId,
          recordStatus: recordStatus || "Active",
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("ONU updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:onuId — soft delete.
 *
 * Refused while the ONU is `active` or `suspended` at the OLT. Deleting the
 * record would leave a device still bound on the device with nothing in the
 * system tracking it — and, if it was suspended for non-payment, no way to turn
 * it back on when the customer pays.
 *
 * The subscription guard tolerates `subscriptions` not existing until S4.
 */
router.delete(
  "/:onuId",
  checkPermission("network", "onus", "write"),
  catchAsync(async (req, res) => {
    const { onuId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedOnu(conn, req, onuId, {
        columns: "onuId, serialNo, mac, provisioningState, recordStatus",
        forUpdate: true,
      });

      if (["active", "suspended"].includes(before.provisioningState)) {
        await req.db.rollback(conn);
        return res.sendError(
          `This ONU is currently '${before.provisioningState}' at the OLT. Deprovision it first.`,
          409
        );
      }

      const [tableRows] = await conn.execute(
        `SELECT COUNT(*) AS present FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions'`
      );

      if (tableRows[0].present > 0) {
        const [bound] = await conn.execute(
          `SELECT COUNT(*) AS total FROM subscriptions
           WHERE onuId = ? AND status != 'terminated'`,
          [onuId]
        );

        if (bound[0].total > 0) {
          await req.db.rollback(conn);
          return res.sendError(
            "This ONU is bound to an active subscription. Terminate it first.",
            409
          );
        }
      }

      await conn.execute(
        `UPDATE onus SET recordStatus = 'Deleted', dateUpdated = ?
         WHERE onuId = ? AND companyId = ? AND recordStatus != 'Deleted'`,
        [now, onuId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "onu.delete",
        description: `Deleted ONU ${before.mac || before.serialNo}`,
        before,
        after: { ...before, recordStatus: "Deleted" },
      });

      await req.db.commit(conn);
      return res.sendSuccess("ONU deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
