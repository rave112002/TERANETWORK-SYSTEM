import { getCurrentTimestampLocal } from "./dateUtils.js";

/**
 * In-transaction audit writing.
 *
 * ── Why this exists alongside the audit middleware ──────────────────────────
 *
 * `middlewares/auditTrail.middleware.js` logs a route AFTER the response is
 * sent. That is right for ordinary CRUD, and wrong for anything this system
 * does to a customer's service: if the audit row is written outside the
 * transaction, a rollback leaves the change undone but the log claiming it
 * happened — or the reverse. For a platform that can disconnect a paying
 * customer, "what actually happened" has to be one atomic fact.
 *
 * So sensitive mutations call `writeAudit(conn, …)` with the SAME connection
 * that made the change: either both land or neither does.
 *
 * Use it for: ONU activate/deactivate, subscription state changes, invoice void
 * and adjustments, payment settlement, dunning exemptions, DRY_RUN and other
 * system-setting changes, discovery imports, and outage-credit approvals.
 *
 * Ordinary CRUD keeps the route middleware. Both write to `audit_trail`, so
 * there is one table and one screen to read.
 *
 * ── Append-only ─────────────────────────────────────────────────────────────
 *
 * Nothing updates or deletes an audit row. Grant the application's database
 * user no UPDATE or DELETE on `audit_trail` so that stays true even if a future
 * bug tries.
 *
 * ── Redaction ───────────────────────────────────────────────────────────────
 *
 * Before/after snapshots are whole row objects, and some rows carry encrypted
 * device credentials or password hashes. Those keys are stripped here rather
 * than at each call site — one place to get right, and a new caller cannot
 * forget.
 */

/**
 * Keys never written to the audit log, matched case-insensitively as a
 * substring so `credentialsEnc`, `credentials_enc` and `password_hash` all hit.
 */
const REDACTED_KEYS = [
  "password",
  "credential",
  "secret",
  "token",
  "totp",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
];

const isRedacted = (key) => {
  const lower = String(key).toLowerCase();
  return REDACTED_KEYS.some((needle) => lower.includes(needle));
};

/**
 * Copy a row for the audit log, replacing sensitive values with a marker.
 * Returns `null` unchanged so "there was no before state" stays distinguishable
 * from "the before state was empty".
 *
 * @param {Object|null|undefined} state
 * @returns {Object|null}
 */
export const redactState = (state) => {
  if (state === null || state === undefined) return null;
  if (typeof state !== "object") return { value: state };

  const output = {};
  for (const [key, value] of Object.entries(state)) {
    if (isRedacted(key)) {
      output[key] = value === null || value === undefined ? null : "[redacted]";
    } else if (Buffer.isBuffer(value)) {
      // Encrypted credential blobs — record the shape, never the bytes.
      output[key] = `[binary ${value.length} bytes]`;
    } else {
      output[key] = value;
    }
  }
  return output;
};

/**
 * Everything the audit row needs about who is acting, pulled off `req` so
 * callers do not reach into `req.user` themselves.
 *
 * @param {import('express').Request} req
 * @returns {{accountId: string, companyId: string|null, branchId: string|null, ip: string|null, userAgent: string|null}}
 */
export const getAuditContext = (req) => ({
  accountId: req.user?.accountId ?? null,
  companyId: req.user?.companyId ?? null,
  // The actor's HOME branch — where this person works. Not their read scope.
  branchId: req.user?.branchId ?? null,
  ip: req.ip ?? null,
  userAgent: req.get?.("user-agent") ?? null,
});

/**
 * Write one audit row on an open transaction connection.
 *
 * @param {import('mysql2/promise').PoolConnection} conn - the SAME connection
 *   that is making the change. Passing a pooled `req.db` here would defeat the
 *   whole point: the row would commit independently of the change.
 * @param {Object} entry
 * @param {Object} entry.context - from {@link getAuditContext}, or a synthetic
 *   context for system actions (see {@link systemAuditContext}).
 * @param {string} entry.module - the audited area, e.g. "onus", "invoices".
 * @param {string} entry.action - what happened, e.g. "deactivate", "settle".
 * @param {string} [entry.description] - one human-readable line.
 * @param {Object|null} [entry.before] - row state before the change.
 * @param {Object|null} [entry.after] - row state after the change.
 * @param {Object} [entry.meta] - extra context (job id, device response id, …).
 * @returns {Promise<string>} the generated auditId.
 *
 * @example
 *   const conn = await req.db.beginTransaction();
 *   const [[before]] = await conn.execute(`SELECT * FROM onus WHERE onuId = ?`, [onuId]);
 *   await conn.execute(`UPDATE onus SET provisioningState = 'suspended' ... `);
 *   await writeAudit(conn, {
 *     context: getAuditContext(req),
 *     module: "onus",
 *     action: "deactivate",
 *     description: `ONU ${before.serialNo} suspended for non-payment`,
 *     before,
 *     after: { ...before, provisioningState: "suspended" },
 *   });
 *   await req.db.commit(conn);
 */
export const writeAudit = async (
  conn,
  { context, module, action, description = null, before = null, after = null, meta = null }
) => {
  const now = getCurrentTimestampLocal();

  const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
  const auditId = uuidRow[0].id;

  const metadata = {
    before: redactState(before),
    after: redactState(after),
    ...(meta ? { meta } : {}),
  };

  await conn.execute(
    `INSERT INTO audit_trail
       (auditId, companyId, branchId, accountId, action, module, description, metadata, ipAddress, userAgent, dateCreated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      auditId,
      context.companyId ?? null,
      context.branchId ?? null,
      context.accountId,
      action,
      module,
      description,
      JSON.stringify(metadata),
      context.ip ?? null,
      context.userAgent ?? null,
      now,
    ]
  );

  return auditId;
};

/**
 * Audit context for work with no logged-in human behind it — the billing cycle,
 * the dunning sweep, the provisioning worker, a payment webhook.
 *
 * `accountId` is NOT NULL on `audit_trail`, so system actions carry a readable
 * pseudo-account instead: reading "who disconnected this customer?" should
 * answer "system:dunning", never an empty cell.
 *
 * @param {string} source - e.g. "dunning", "billing-cycle", "xendit-webhook".
 * @param {{companyId?: string, branchId?: string}} [scope]
 */
export const systemAuditContext = (source, scope = {}) => ({
  accountId: `system:${source}`,
  companyId: scope.companyId ?? null,
  branchId: scope.branchId ?? null,
  ip: null,
  userAgent: null,
});

export default { writeAudit, getAuditContext, systemAuditContext, redactState };
