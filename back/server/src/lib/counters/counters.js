import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";

/**
 * Sequence numbers for human-readable business identifiers — `ACC-000123`
 * today, `INV-2026-000123` when billing lands.
 *
 * ── Why not MAX(...) + 1 ────────────────────────────────────────────────────
 *
 * Two staff creating a subscriber at the same moment both read the same MAX and
 * both write the same account number; one of them hits the UNIQUE constraint
 * and sees a 500. `MAX ... FOR UPDATE` does not fix it either — there is no row
 * to lock for a number that does not exist yet.
 *
 * So the number comes from a counter row, allocated with MySQL's
 * `LAST_INSERT_ID(expr)` trick: the UPDATE both increments the stored value and
 * publishes the pre-increment value back to this connection, atomically, under
 * the row lock the UPDATE already takes. No read-then-write gap.
 *
 * ── Call it inside the caller's transaction ─────────────────────────────────
 *
 * Always pass the same `conn` doing the insert. A number allocated on a
 * different connection would survive a rollback of the row it was meant for,
 * silently burning identifiers — harmless for account numbers, but a gap in an
 * invoice sequence is the kind of thing an auditor asks about.
 */

/**
 * Allocate the next number in a named sequence.
 *
 * @param {import('mysql2/promise').PoolConnection} conn - the caller's open
 *   transaction connection.
 * @param {string} name - sequence key, e.g. `"customerAccountNo"` or
 *   `"invoiceNo:2026"`. Max 64 chars.
 * @returns {Promise<number>} the allocated value, starting at 1.
 */
export const nextSequence = async (conn, name) => {
  const now = getCurrentTimestampLocal();

  // Inserting `nextValue = 2` on first use means the value handed out now is 1.
  // On every later call the ON DUPLICATE branch runs instead, and
  // LAST_INSERT_ID(nextValue) makes the pre-increment value readable as
  // `insertId` on this connection only.
  const [result] = await conn.execute(
    `INSERT INTO counters (name, nextValue, dateUpdated)
     VALUES (?, 2, ?)
     ON DUPLICATE KEY UPDATE
       nextValue = LAST_INSERT_ID(nextValue) + 1,
       dateUpdated = VALUES(dateUpdated)`,
    [name, now]
  );

  // affectedRows is 1 for a fresh insert and 2 for an update — the driver's way
  // of reporting which branch ran.
  return result.affectedRows === 1 ? 1 : Number(result.insertId);
};

/**
 * Format a sequence value as a prefixed, zero-padded reference.
 *
 * Padding is a display convention, not a limit: once the sequence outgrows the
 * width the number simply gets longer rather than wrapping or colliding.
 *
 * @param {string} prefix - e.g. `"ACC"`.
 * @param {number} value - from {@link nextSequence}.
 * @param {number} [width=6] - digits to pad to.
 * @returns {string} e.g. `"ACC-000123"`.
 */
export const formatReference = (prefix, value, width = 6) =>
  `${prefix}-${String(value).padStart(width, "0")}`;

/**
 * Allocate the next subscriber account number.
 *
 * Scoped per company so the numbering reads as one continuous sequence for the
 * ISP rather than restarting per branch — an account number is how staff and
 * customers refer to an account on the phone, and it should not depend on which
 * office opened it.
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} companyId
 * @returns {Promise<string>} e.g. `"ACC-000123"`.
 */
export const nextAccountNo = async (conn, companyId) => {
  const value = await nextSequence(conn, `customerAccountNo:${companyId}`);
  return formatReference("ACC", value);
};

export default { nextSequence, formatReference, nextAccountNo };
