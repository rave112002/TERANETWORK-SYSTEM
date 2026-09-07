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
import { encryptCredentials } from "../../../lib/crypto/credentialCrypto.js";
import { findScopedOlt } from "../../../lib/network/network.helpers.js";
import {
  createOltSchema,
  updateOltSchema,
  listOltsQuerySchema,
} from "../../../validators/network.validator.js";

const router = express.Router();

/**
 * OLTs — the head-end devices this system logs into to suspend and restore a
 * subscriber's service.
 *
 * ── Credentials never leave ─────────────────────────────────────────────────
 *
 * `credentialsEnc` is envelope-encrypted and is **never** selected into a
 * response, not even redacted-but-present. Responses carry a boolean
 * `hasCredentials` instead, which is all a form needs to render "credentials
 * set — replace?" without the API ever being a route to read them back.
 */

// Deliberately excludes credentialsEnc. Adding it here would leak the blob to
// every list response, so the omission is the safeguard.
const OLT_COLUMNS = `o.oltId, o.companyId, o.branchId, o.name, o.vendor, o.ponTechnology,
  o.model, o.host, o.port, o.protocol, o.site, o.maxConcurrentSessions, o.notes,
  o.status, o.dateCreated, o.dateUpdated,
  (o.credentialsEnc IS NOT NULL) AS hasCredentials`;

/**
 * GET /
 * List OLTs across the branches this user is assigned to.
 */
router.get(
  "/",
  checkPermission("network", "olts", "read"),
  validateQuery(listOltsQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      branchId,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("o.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE o.companyId = ?${scope.clause}`;

    if (branchId) {
      whereClause += " AND o.branchId = ?";
      params.push(branchId);
    }

    if (status) {
      whereClause += " AND o.status = ?";
      params.push(status);
    } else {
      whereClause += " AND o.status != 'Deleted'";
    }

    if (search) {
      whereClause += " AND (o.name LIKE ? OR o.host LIKE ? OR o.site LIKE ? OR o.model LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "name", "vendor"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, olts] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM olts o ${whereClause}`, params),
      req.db.query(
        `SELECT ${OLT_COLUMNS}, b.name AS branchName,
                (SELECT COUNT(*) FROM pon_ports pp
                  WHERE pp.oltId = o.oltId AND pp.status != 'Deleted') AS ponPortCount
         FROM olts o
         LEFT JOIN branches b ON b.branchId = o.branchId
         ${whereClause}
         ORDER BY o.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("OLTs retrieved successfully", {
      olts,
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
 * GET /:oltId
 */
router.get(
  "/:oltId",
  checkPermission("network", "olts", "read"),
  catchAsync(async (req, res) => {
    const { oltId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("o.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT ${OLT_COLUMNS}, b.name AS branchName
       FROM olts o
       LEFT JOIN branches b ON b.branchId = o.branchId
       WHERE o.oltId = ? AND o.companyId = ?${scope.clause} AND o.status != 'Deleted'
       LIMIT 1`,
      [oltId, companyId, ...scope.params]
    );

    if (rows.length === 0) {
      return res.sendError("OLT not found", 404);
    }

    return res.sendSuccess("OLT retrieved successfully", { olt: rows[0] });
  })
);

/**
 * POST /
 */
router.post(
  "/",
  checkPermission("network", "olts", "write"),
  validateBody(createOltSchema),
  catchAsync(async (req, res) => {
    const {
      name,
      vendor,
      ponTechnology,
      model,
      host,
      port,
      protocol,
      site,
      maxConcurrentSessions,
      notes,
      credentials,
      branchId,
    } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    const targetBranchId = branchId || req.user.branchId;
    assertBranchInScope(req.user, targetBranchId);

    // Encrypt before opening the transaction: a missing master key should fail
    // the request outright, not roll back a half-done write.
    const credentialsEnc = credentials ? encryptCredentials(credentials) : null;

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [existing] = await conn.execute(
        `SELECT oltId FROM olts
         WHERE name = ? AND companyId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [name, companyId]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("An OLT with this name already exists", 409);
      }

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const oltId = uuidRow[0].id;

      await conn.execute(
        `INSERT INTO olts
           (oltId, companyId, branchId, name, vendor, ponTechnology, model, host, port,
            protocol, credentialsEnc, site, maxConcurrentSessions, notes, status,
            dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [
          oltId,
          companyId,
          targetBranchId,
          name,
          vendor,
          ponTechnology,
          model || null,
          host,
          port,
          protocol,
          credentialsEnc,
          site || null,
          maxConcurrentSessions,
          notes || null,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "olt.create",
        description: `Added OLT "${name}" (${vendor} at ${host}:${port})`,
        // The credential blob is not passed in: writeAudit would redact the key
        // name, but the safest blob is the one never handed to the logger.
        after: {
          oltId,
          branchId: targetBranchId,
          name,
          vendor,
          ponTechnology,
          model,
          host,
          port,
          protocol,
          site,
          maxConcurrentSessions,
          hasCredentials: Boolean(credentialsEnc),
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("OLT created successfully", { oltId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:oltId
 *
 * Omitting `credentials` keeps whatever is stored. The edit form cannot display
 * a password, so it must not be able to erase one by simply not sending it.
 */
router.put(
  "/:oltId",
  checkPermission("network", "olts", "write"),
  validateBody(updateOltSchema),
  catchAsync(async (req, res) => {
    const { oltId } = req.params;
    const {
      name,
      vendor,
      ponTechnology,
      model,
      host,
      port,
      protocol,
      site,
      maxConcurrentSessions,
      notes,
      credentials,
      status,
    } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    const credentialsEnc = credentials ? encryptCredentials(credentials) : null;

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedOlt(conn, req, oltId, {
        columns: `oltId, branchId, name, vendor, ponTechnology, model, host, port, protocol,
                  site, maxConcurrentSessions, notes, status,
                  (credentialsEnc IS NOT NULL) AS hasCredentials`,
        forUpdate: true,
      });

      const [clash] = await conn.execute(
        `SELECT oltId FROM olts
         WHERE name = ? AND companyId = ? AND oltId != ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [name, companyId, oltId]
      );

      if (clash.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("Another OLT already uses this name", 409);
      }

      await conn.execute(
        `UPDATE olts
         SET name = ?, vendor = ?, ponTechnology = ?, model = ?, host = ?, port = ?,
             protocol = ?, site = ?, maxConcurrentSessions = ?, notes = ?, status = ?,
             credentialsEnc = COALESCE(?, credentialsEnc), dateUpdated = ?
         WHERE oltId = ? AND companyId = ? AND status != 'Deleted'`,
        [
          name,
          vendor,
          ponTechnology,
          model || null,
          host,
          port,
          protocol,
          site || null,
          maxConcurrentSessions,
          notes || null,
          status || "Active",
          credentialsEnc,
          now,
          oltId,
          companyId,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "olt.update",
        description: credentials
          ? `Updated OLT "${name}" and replaced its credentials`
          : `Updated OLT "${name}"`,
        before,
        after: {
          ...before,
          name,
          vendor,
          ponTechnology,
          model,
          host,
          port,
          protocol,
          site,
          maxConcurrentSessions,
          status: status || "Active",
          hasCredentials: Boolean(credentialsEnc) || Boolean(before.hasCredentials),
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("OLT updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:oltId — soft delete.
 *
 * Refused while PON ports still hang off it. Removing the OLT would orphan the
 * whole tree beneath it and leave every ONU below unable to resolve a driver.
 */
router.delete(
  "/:oltId",
  checkPermission("network", "olts", "write"),
  catchAsync(async (req, res) => {
    const { oltId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedOlt(conn, req, oltId, {
        columns: "oltId, name, host, status",
        forUpdate: true,
      });

      const [ports] = await conn.execute(
        `SELECT COUNT(*) AS total FROM pon_ports WHERE oltId = ? AND status != 'Deleted'`,
        [oltId]
      );

      if (ports[0].total > 0) {
        await req.db.rollback(conn);
        return res.sendError(
          `This OLT still has ${ports[0].total} PON port(s). Remove them first.`,
          409
        );
      }

      await conn.execute(
        `UPDATE olts SET status = 'Deleted', credentialsEnc = NULL, dateUpdated = ?
         WHERE oltId = ? AND companyId = ? AND status != 'Deleted'`,
        [now, oltId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "olt.delete",
        // Credentials are dropped on delete rather than left encrypted forever:
        // a retired device's login has no reason to stay recoverable.
        description: `Deleted OLT "${before.name}" and cleared its stored credentials`,
        before,
        after: { ...before, status: "Deleted", hasCredentials: false },
      });

      await req.db.commit(conn);
      return res.sendSuccess("OLT deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
