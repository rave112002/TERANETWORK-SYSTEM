import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import {
  findScopedSplitter,
  resolveSplitterParent,
} from "../../../lib/network/network.helpers.js";
import {
  createSplitterSchema,
  updateSplitterSchema,
  listSplittersQuerySchema,
} from "../../../validators/network.validator.js";

const router = express.Router();

/**
 * Optical splitters.
 *
 * The parent is polymorphic — a splitter hangs off a PON port or off another
 * splitter (cascading) — which MySQL cannot express as a foreign key. So this
 * controller is where parent validity actually lives:
 *
 *   - the parent must exist and be inside the caller's branch scope
 *   - a splitter may not be its own parent
 *   - re-parenting may not create a cycle, which would make the chain walk
 *     (and the topology tree, and driver resolution for every ONU below) spin
 */

/**
 * Walk up from `startId`, watching for `forbiddenId` on the way.
 *
 * Used only by the re-parent check: `resolveSplitterChain` throws on a loop,
 * which is right for reads but unhelpful when the question is "would this
 * particular move create one?".
 *
 * @returns {Promise<{wouldLoop: boolean}>}
 */
const resolveSplitterChainSafely = async (conn, req, startId, forbiddenId) => {
  const MAX_DEPTH = 10;
  let currentId = startId;

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (currentId === forbiddenId) return { wouldLoop: true };

    const splitter = await findScopedSplitter(conn, req, currentId, {
      columns: "splitterId, parentType, parentId",
    });

    if (splitter.parentType === "pon_port") return { wouldLoop: false };
    currentId = splitter.parentId;
  }

  // Depth exhausted means the existing data is already cyclic; refuse the move
  // rather than write into a structure that cannot be walked.
  return { wouldLoop: true };
};

const SPLITTER_COLUMNS = `s.splitterId, s.companyId, s.branchId, s.parentType, s.parentId,
  s.ratio, s.label, s.location, s.status, s.dateCreated, s.dateUpdated`;

/** Human label for a parent, whichever kind it is — used in list responses. */
const PARENT_LABEL = `CASE s.parentType
    WHEN 'pon_port' THEN (SELECT CONCAT(o.name, ' · port ', pp.portIndex)
                          FROM pon_ports pp LEFT JOIN olts o ON o.oltId = pp.oltId
                          WHERE pp.ponPortId = s.parentId)
    ELSE (SELECT ps.label FROM splitters ps WHERE ps.splitterId = s.parentId)
  END`;

/**
 * GET /
 */
router.get(
  "/",
  checkPermission("network", "splitters", "read"),
  validateQuery(listSplittersQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      branchId,
      parentType,
      parentId,
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
    if (parentType) {
      whereClause += " AND s.parentType = ?";
      params.push(parentType);
    }
    if (parentId) {
      whereClause += " AND s.parentId = ?";
      params.push(parentId);
    }

    if (status) {
      whereClause += " AND s.status = ?";
      params.push(status);
    } else {
      whereClause += " AND s.status != 'Deleted'";
    }

    if (search) {
      whereClause += " AND (s.label LIKE ? OR s.location LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "label", "ratio"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, splitters] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM splitters s ${whereClause}`, params),
      req.db.query(
        `SELECT ${SPLITTER_COLUMNS},
                ${PARENT_LABEL} AS parentLabel,
                (SELECT COUNT(*) FROM naps n
                  WHERE n.splitterId = s.splitterId AND n.status != 'Deleted') AS napCount,
                (SELECT COUNT(*) FROM splitters cs
                  WHERE cs.parentType = 'splitter' AND cs.parentId = s.splitterId
                    AND cs.status != 'Deleted') AS childSplitterCount
         FROM splitters s
         ${whereClause}
         ORDER BY s.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Splitters retrieved successfully", {
      splitters,
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
 * GET /:splitterId
 */
router.get(
  "/:splitterId",
  checkPermission("network", "splitters", "read"),
  catchAsync(async (req, res) => {
    const { splitterId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("s.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT ${SPLITTER_COLUMNS}, ${PARENT_LABEL} AS parentLabel
       FROM splitters s
       WHERE s.splitterId = ? AND s.companyId = ?${scope.clause} AND s.status != 'Deleted'
       LIMIT 1`,
      [splitterId, companyId, ...scope.params]
    );

    if (rows.length === 0) {
      return res.sendError("Splitter not found", 404);
    }

    return res.sendSuccess("Splitter retrieved successfully", { splitter: rows[0] });
  })
);

/**
 * POST /
 */
router.post(
  "/",
  checkPermission("network", "splitters", "write"),
  validateBody(createSplitterSchema),
  catchAsync(async (req, res) => {
    const { parentType, parentId, ratio, label, location } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Throws 404 if the parent is missing or out of scope. The branch comes
      // from the parent — a splitter lives wherever the thing feeding it does.
      const parent = await resolveSplitterParent(conn, req, { parentType, parentId });

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const splitterId = uuidRow[0].id;

      await conn.execute(
        `INSERT INTO splitters
           (splitterId, companyId, branchId, parentType, parentId, ratio, label, location,
            status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [
          splitterId,
          companyId,
          parent.branchId,
          parentType,
          parentId,
          ratio,
          label,
          location || null,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "splitter.create",
        description: `Added ${ratio} splitter "${label}"`,
        after: {
          splitterId,
          branchId: parent.branchId,
          parentType,
          parentId,
          ratio,
          label,
          location,
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("Splitter created successfully", { splitterId }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:splitterId
 *
 * Re-parenting is allowed — plant does get re-wired — but the result must still
 * be a tree. A splitter cannot become its own parent, and cannot be moved under
 * one of its own descendants.
 */
router.put(
  "/:splitterId",
  checkPermission("network", "splitters", "write"),
  validateBody(updateSplitterSchema),
  catchAsync(async (req, res) => {
    const { splitterId } = req.params;
    const { parentType, parentId, ratio, label, location, status } = req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedSplitter(conn, req, splitterId, {
        columns: "splitterId, branchId, parentType, parentId, ratio, label, location, status",
        forUpdate: true,
      });

      if (parentType === "splitter" && parentId === splitterId) {
        await req.db.rollback(conn);
        return res.sendError("A splitter cannot be its own parent", 409);
      }

      const parent = await resolveSplitterParent(conn, req, { parentType, parentId });

      // Walking up from the proposed parent must reach a PON port. If this
      // splitter is anywhere on that path the move would close a loop, and the
      // walk throws rather than returning.
      if (parentType === "splitter") {
        const chain = await resolveSplitterChainSafely(conn, req, parentId, splitterId);
        if (chain.wouldLoop) {
          await req.db.rollback(conn);
          return res.sendError(
            "That parent sits below this splitter — the move would create a loop",
            409
          );
        }
      }

      await conn.execute(
        `UPDATE splitters
         SET parentType = ?, parentId = ?, branchId = ?, ratio = ?, label = ?, location = ?,
             status = ?, dateUpdated = ?
         WHERE splitterId = ? AND companyId = ? AND status != 'Deleted'`,
        [
          parentType,
          parentId,
          parent.branchId,
          ratio,
          label,
          location || null,
          status || "Active",
          now,
          splitterId,
          companyId,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "splitter.update",
        description: `Updated splitter "${label}"`,
        before,
        after: {
          ...before,
          parentType,
          parentId,
          branchId: parent.branchId,
          ratio,
          label,
          location: location || null,
          status: status || "Active",
        },
      });

      await req.db.commit(conn);
      return res.sendSuccess("Splitter updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:splitterId — soft delete.
 *
 * Refused while NAPs or child splitters still hang off it.
 */
router.delete(
  "/:splitterId",
  checkPermission("network", "splitters", "write"),
  catchAsync(async (req, res) => {
    const { splitterId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const before = await findScopedSplitter(conn, req, splitterId, {
        columns: "splitterId, label, ratio, status",
        forUpdate: true,
      });

      const [children] = await conn.execute(
        `SELECT
           (SELECT COUNT(*) FROM naps n
             WHERE n.splitterId = ? AND n.status != 'Deleted') AS naps,
           (SELECT COUNT(*) FROM splitters cs
             WHERE cs.parentType = 'splitter' AND cs.parentId = ? AND cs.status != 'Deleted') AS children`,
        [splitterId, splitterId]
      );

      const counts = children[0];
      if (counts.naps > 0 || counts.children > 0) {
        await req.db.rollback(conn);
        return res.sendError(
          `This splitter still feeds ${counts.naps} NAP(s) and ${counts.children} splitter(s). Remove them first.`,
          409
        );
      }

      await conn.execute(
        `UPDATE splitters SET status = 'Deleted', dateUpdated = ?
         WHERE splitterId = ? AND companyId = ? AND status != 'Deleted'`,
        [now, splitterId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "network",
        action: "splitter.delete",
        description: `Deleted splitter "${before.label}"`,
        before,
        after: { ...before, status: "Deleted" },
      });

      await req.db.commit(conn);
      return res.sendSuccess("Splitter deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
