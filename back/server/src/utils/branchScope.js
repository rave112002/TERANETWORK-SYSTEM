/**
 * Branch scoping — the single place that decides which branches a request may
 * see.
 *
 * TERANETWORK is one company with several branches, and a user works in one or
 * more of them (see `user_branches`). So the tenant predicate is
 * `branchId IN (...)`, not `branchId = ?`. Every branch-scoped query must build
 * its clause here rather than hand-rolling an IN list, so there is exactly one
 * place to audit when asking "can this user see that branch's data?".
 *
 * Two ideas are deliberately kept apart:
 *
 *   - **Scope** (this file) — every branch the user may READ. From
 *     `req.user.branchIds`, populated by the JWT strategy.
 *   - **Home branch** (`req.user.branchId`) — the single branch new records they
 *     create are filed under, and where their uploads are stored. Unchanged.
 */

import APIError, { ERROR_CODES } from "./APIError.js";

/**
 * A single SQL identifier. Checked per dot-separated part rather than with one
 * combined pattern — an optional group wrapping a repeated character class is
 * exactly the shape that backtracks badly on a long non-matching input.
 */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** True for `column` or `alias.column`, and nothing else. */
const isColumnRef = (ref) => {
  const parts = String(ref).split(".");
  return parts.length <= 2 && parts.every((part) => IDENTIFIER.test(part));
};

/**
 * The branches a request may read.
 *
 * @param {Object} user - `req.user` from the JWT strategy.
 * @returns {string[]|null} the branch IDs, or `null` for SuperAdmin (meaning
 *   "unrestricted" — SuperAdmin operates across the whole company).
 *
 * @example getScopedBranchIds(req.user) // -> ['b1f2...', 'c3d4...']
 * @example getScopedBranchIds(superAdmin) // -> null
 */
export const getScopedBranchIds = (user) => {
  if (!user) return [];
  if (user.type === "SUPERADMIN") return null;

  const assigned = Array.isArray(user.branchIds) ? user.branchIds.filter(Boolean) : [];
  if (assigned.length > 0) return assigned;

  // A user always has at least their home branch mirrored into user_branches
  // (migration 001 backfills it), so this is belt-and-braces for a row that was
  // inserted without one.
  return user.branchId ? [user.branchId] : [];
};

/**
 * Build the `AND <column> IN (...)` fragment for a branch-scoped query.
 *
 * Returns an empty clause for SuperAdmin (`branchIds === null`) and a
 * **fail-closed** `AND 1 = 0` when the caller has no branches at all — a user
 * with no assignment must see nothing, never everything.
 *
 * @param {string} column - `branchId` or `alias.branchId`. Developer-supplied
 *   only; it is interpolated, not bound.
 * @param {string[]|null} branchIds - from {@link getScopedBranchIds}.
 * @returns {{ clause: string, params: string[] }}
 *
 * @example
 *   const branchIds = getScopedBranchIds(req.user);
 *   const scope = branchScope("u.branchId", branchIds);
 *   const rows = await req.db.query(
 *     `SELECT * FROM users u WHERE u.companyId = ?${scope.clause}`,
 *     [companyId, ...scope.params]
 *   );
 */
export const branchScope = (column, branchIds) => {
  if (!isColumnRef(column)) {
    throw new APIError(`Unsafe branch scope column '${column}'`, 500, ERROR_CODES.INTERNAL_ERROR);
  }

  if (branchIds === null) return { clause: "", params: [] };
  if (branchIds.length === 0) return { clause: " AND 1 = 0", params: [] };

  const placeholders = branchIds.map(() => "?").join(", ");
  return { clause: ` AND ${column} IN (${placeholders})`, params: [...branchIds] };
};

/**
 * Assert that a branch the caller supplied (e.g. "create this customer in
 * branch X") is one they are actually assigned to. Use before any write that
 * targets a branch other than the caller's home branch.
 *
 * @param {Object} user - `req.user`.
 * @param {string} branchId - the branch the request wants to write to.
 * @throws {APIError} 403 when the branch is outside the caller's scope.
 */
export const assertBranchInScope = (user, branchId) => {
  const branchIds = getScopedBranchIds(user);
  if (branchIds === null) return; // SuperAdmin
  if (!branchIds.includes(branchId)) {
    throw new APIError("You do not have access to that branch", 403, ERROR_CODES.FORBIDDEN);
  }
};

export default { getScopedBranchIds, branchScope, assertBranchInScope };
