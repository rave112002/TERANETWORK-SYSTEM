import APIError, { ERROR_CODES } from "../../utils/APIError.js";
import { branchScope, getScopedBranchIds } from "../../utils/branchScope.js";

/**
 * Shared lookups for the network inventory chain
 * (OLT → PON port → splitter → NAP → ONU).
 *
 * Two things every network controller needs and must not get subtly different:
 *
 *   1. **Scoped parent lookups.** Before attaching a child to a parent, the
 *      parent has to exist AND be inside the caller's branch scope — otherwise
 *      a technician could graft a NAP onto another branch's splitter and read
 *      its subtree.
 *   2. **Topology resolution.** An ONU's `oltId`/`ponPortId` are denormalised so
 *      the provisioning worker can go ONU → driver in one query. They must be
 *      derived from the NAP, never accepted from the client, or the worker
 *      could be pointed at the wrong device.
 *
 * These are lookups, not a CRUD factory: each controller still writes its own
 * routes, validation and SQL.
 */

/** Missing and out-of-scope are both reported as 404 so IDs cannot be probed. */
const notFound = (label) => new APIError(`${label} not found`, 404, ERROR_CODES.RESOURCE_NOT_FOUND);

/**
 * Fetch a row from a network table, scoped to the caller's company and branches.
 *
 * @param {import('mysql2/promise').PoolConnection} conn - the caller's transaction.
 * @param {Object} req
 * @param {Object} spec
 * @param {string} spec.table - e.g. "olts"
 * @param {string} spec.idColumn - e.g. "oltId"
 * @param {string} spec.id - the business ID being looked up
 * @param {string} spec.label - human name for the error, e.g. "OLT"
 * @param {string} [spec.columns="*"]
 * @param {string} [spec.statusColumn="status"] - `onus` uses `recordStatus`
 * @param {boolean} [spec.forUpdate=false] - lock the row (check-then-write)
 * @returns {Promise<Object>} the row
 * @throws {APIError} 404 when absent, deleted, or outside the caller's scope
 */
export const findScopedRow = async (
  conn,
  req,
  { table, idColumn, id, label, columns = "*", statusColumn = "status", forUpdate = false }
) => {
  const scope = branchScope("branchId", getScopedBranchIds(req.user));

  const [rows] = await conn.execute(
    `SELECT ${columns} FROM ${table}
     WHERE ${idColumn} = ? AND companyId = ?${scope.clause} AND ${statusColumn} != 'Deleted'
     LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [id, req.user.companyId, ...scope.params]
  );

  if (rows.length === 0) throw notFound(label);
  return rows[0];
};

/** @see findScopedRow */
export const findScopedOlt = (conn, req, oltId, opts = {}) =>
  findScopedRow(conn, req, { table: "olts", idColumn: "oltId", id: oltId, label: "OLT", ...opts });

/** @see findScopedRow */
export const findScopedPonPort = (conn, req, ponPortId, opts = {}) =>
  findScopedRow(conn, req, {
    table: "pon_ports",
    idColumn: "ponPortId",
    id: ponPortId,
    label: "PON port",
    ...opts,
  });

/** @see findScopedRow */
export const findScopedSplitter = (conn, req, splitterId, opts = {}) =>
  findScopedRow(conn, req, {
    table: "splitters",
    idColumn: "splitterId",
    id: splitterId,
    label: "Splitter",
    ...opts,
  });

/** @see findScopedRow */
export const findScopedNap = (conn, req, napId, opts = {}) =>
  findScopedRow(conn, req, { table: "naps", idColumn: "napId", id: napId, label: "NAP", ...opts });

/** @see findScopedRow */
export const findScopedOnu = (conn, req, onuId, opts = {}) =>
  findScopedRow(conn, req, {
    table: "onus",
    idColumn: "onuId",
    id: onuId,
    label: "ONU",
    statusColumn: "recordStatus",
    ...opts,
  });

/**
 * Resolve a splitter's parent, whichever kind it is.
 *
 * @returns {Promise<{branchId: string, ponPortId: string|null}>} the branch the
 *   parent sits in, and the PON port at the root of the chain (null if the
 *   chain never reaches one, which the caller should treat as unwired).
 */
export const resolveSplitterParent = async (conn, req, { parentType, parentId }) => {
  if (parentType === "pon_port") {
    const port = await findScopedPonPort(conn, req, parentId, {
      columns: "ponPortId, branchId, oltId",
    });
    return { branchId: port.branchId, ponPortId: port.ponPortId };
  }

  const parent = await findScopedSplitter(conn, req, parentId, {
    columns: "splitterId, branchId, parentType, parentId",
  });
  const root = await resolveSplitterChain(conn, req, parent.splitterId);
  return { branchId: parent.branchId, ponPortId: root.ponPortId };
};

/**
 * Walk a cascade of splitters up to the PON port at its root.
 *
 * Cascading is legitimate (a 1:8 feeding four 1:16s), but a cycle would hang the
 * walk forever, so depth is capped. A real plant is two or three deep; ten is
 * already impossible optically.
 *
 * @returns {Promise<{ponPortId: string|null, oltId: string|null, depth: number}>}
 */
export const resolveSplitterChain = async (conn, req, splitterId) => {
  const MAX_DEPTH = 10;
  let currentId = splitterId;

  for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
    const splitter = await findScopedSplitter(conn, req, currentId, {
      columns: "splitterId, parentType, parentId",
    });

    if (splitter.parentType === "pon_port") {
      const port = await findScopedPonPort(conn, req, splitter.parentId, {
        columns: "ponPortId, oltId",
      });
      return { ponPortId: port.ponPortId, oltId: port.oltId, depth };
    }

    currentId = splitter.parentId;
  }

  throw new APIError(
    "Splitter chain is too deep or contains a loop — check the parent of each splitter",
    409,
    ERROR_CODES.INVALID_INPUT
  );
};

/**
 * Work out where an ONU sits, from its NAP.
 *
 * The client supplies only `napId`; `oltId` and `ponPortId` are derived here so
 * the copy the worker reads can never disagree with the topology. If the chain
 * is not yet wired to a PON port the ONU is still storable — it is inventory —
 * it simply cannot be provisioned until it is.
 *
 * @returns {Promise<{branchId: string, oltId: string|null, ponPortId: string|null}>}
 */
export const resolveOnuTopology = async (conn, req, napId) => {
  const nap = await findScopedNap(conn, req, napId, { columns: "napId, branchId, splitterId" });
  const chain = await resolveSplitterChain(conn, req, nap.splitterId);
  return { branchId: nap.branchId, oltId: chain.oltId, ponPortId: chain.ponPortId };
};

export default {
  findScopedRow,
  findScopedOlt,
  findScopedPonPort,
  findScopedSplitter,
  findScopedNap,
  findScopedOnu,
  resolveSplitterParent,
  resolveSplitterChain,
  resolveOnuTopology,
};
