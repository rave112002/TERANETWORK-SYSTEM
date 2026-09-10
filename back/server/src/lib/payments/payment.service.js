import { resolveGatewayForBranch } from "../payment-gateways/index.js";
import { buildPayUrl } from "../qr/payQr.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";
import { logger } from "../../../config/logger.js";
import { toAmount } from "../money/money.js";

/**
 * Opening a checkout for an invoice.
 *
 * Provider-independent: everything here is about *our* rules — which invoices
 * may be paid, how many sessions one bill may have open, what gets recorded.
 * The gateway is asked one question and its answer is written down.
 *
 * ── Idempotency lives here, not in the adapter ──────────────────────────────
 *
 * Xendit can be asked "have I already created this?" by external id. PayMongo
 * cannot — a Link has no queryable reference of ours. Dragonpay keys on a txnid
 * we choose. Three different answers, so relying on the provider would put the
 * guarantee at the mercy of whoever is collecting this month.
 *
 * Instead `payment_attempts` is the record: an open attempt for an invoice is
 * reused rather than replaced. That works identically for all three, and it
 * keeps the guarantee — one live checkout per bill — a property of this system
 * rather than of a vendor.
 */

/** How long a checkout stays open. 30 days: issued on the 15th, due on the 2nd. */
const DEFAULT_EXPIRY_SECONDS = Number(process.env.PAYMENT_EXPIRY_SECONDS || 2592000);

/**
 * The still-usable attempt for an invoice, if there is one.
 *
 * "Usable" means pending and not past its expiry. An expired row is left alone
 * rather than deleted — it is the record of a link somebody may still be
 * holding, and "why did my link stop working" deserves an answer.
 *
 * @param {Object} db
 * @param {string} invoiceId
 * @param {string} provider
 * @returns {Promise<Object|null>}
 */
export const findOpenAttempt = async (db, invoiceId, provider) => {
  const rows = await db.query(
    `SELECT * FROM payment_attempts
      WHERE invoiceId = ? AND provider = ? AND status = 'pending'
        AND (expiresAt IS NULL OR expiresAt > ?)
      ORDER BY id DESC LIMIT 1`,
    [invoiceId, provider, getCurrentTimestampLocal()]
  );
  return rows[0] ?? null;
};

/**
 * Open (or reuse) a checkout for an invoice.
 *
 * @param {Object} db
 * @param {Object} invoice a row with invoiceId, invoiceNo, total, status,
 *   companyId, branchId, publicToken, and the customer's name and email.
 * @returns {Promise<{status: 'ready'|'reused'|'not_payable'|'unavailable', attempt?: Object, paymentUrl?: string, reason?: string}>}
 */
export const createPaymentForInvoice = async (db, invoice) => {
  // Only a bill that is actually owed. Re-opening a checkout for a paid invoice
  // is how a customer pays twice; for a voided one it collects money against a
  // document that says it is not payable.
  if (invoice.status !== "issued" && invoice.status !== "overdue") {
    return { status: "not_payable", reason: invoice.status };
  }

  // Per branch, not per company: the client collects through HitPay in Taguig
  // and GCash Business in Batangas. The invoice already knows which branch it
  // belongs to, so choosing here costs one indexed read and no ambiguity.
  let gateway;
  try {
    gateway = await resolveGatewayForBranch(db, invoice.branchId);
  } catch (err) {
    logger.error(`[payments] ${err.message}`);
    return { status: "unavailable", reason: "no_adapter" };
  }

  if (!gateway.isConfigured()) {
    return { status: "unavailable", reason: "not_configured" };
  }

  const existing = await findOpenAttempt(db, invoice.invoiceId, gateway.name);
  if (existing?.paymentUrl) {
    return { status: "reused", attempt: existing, paymentUrl: existing.paymentUrl };
  }

  const payUrl = buildPayUrl(invoice.publicToken);

  // The gateway call happens BEFORE the row is written, and that is deliberate.
  // A row claiming a checkout that was never opened would be reused forever,
  // handing the customer a dead link every time. A gateway session with no row
  // is merely wasted — the next attempt opens another, and the orphan expires.
  // Of the two ways to be inconsistent, this is the recoverable one.
  let session;
  try {
    session = await gateway.createPayment({
      reference: invoice.invoiceNo,
      amount: toAmount(invoice.total),
      currency: "PHP",
      description: `${invoice.companyName || "Internet service"} — invoice ${invoice.invoiceNo}`,
      payerName: invoice.customerName,
      payerEmail: invoice.customerEmail,
      // Always our own page. The customer comes back somewhere that re-checks
      // the truth, rather than to a gateway's idea of what happened.
      returnUrl: payUrl,
      expiresInSeconds: DEFAULT_EXPIRY_SECONDS,
    });
  } catch (err) {
    logger.error(
      `[payments] ${gateway.name}: could not open a checkout for ${invoice.invoiceNo}: ${err.message}`
    );
    return { status: "unavailable", reason: "gateway_error" };
  }

  if (!session?.paymentUrl) {
    // Loud: a null URL is a dead Pay button, and it fails silently otherwise.
    logger.error(
      `[payments] ${gateway.name}: opened ${invoice.invoiceNo} but returned no payment URL`
    );
    return { status: "unavailable", reason: "no_payment_url" };
  }

  let conn;
  try {
    conn = await db.beginTransaction();

    const [uuidRow] = await conn.execute(`SELECT UUID() AS id`);
    const paymentAttemptId = uuidRow[0].id;
    const now = getCurrentTimestampLocal();

    await conn.execute(
      `INSERT INTO payment_attempts
         (paymentAttemptId, companyId, branchId, invoiceId, provider, reference,
          providerRef, amount, paymentUrl, status, expiresAt, rawResponse,
          dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        paymentAttemptId,
        invoice.companyId,
        invoice.branchId,
        invoice.invoiceId,
        gateway.name,
        invoice.invoiceNo,
        session.providerRef,
        toAmount(invoice.total),
        session.paymentUrl,
        session.expiresAt ?? null,
        JSON.stringify(session.raw ?? {}),
        now,
        now,
      ]
    );

    await db.commit(conn);

    logger.info(
      `[payments] ${gateway.name}: checkout open for ${invoice.invoiceNo} (${session.providerRef})`
    );

    return {
      status: "ready",
      paymentUrl: session.paymentUrl,
      attempt: { paymentAttemptId, providerRef: session.providerRef },
    };
  } catch (err) {
    if (conn) await db.rollback(conn);

    // Two requests raced and the other one won the unique key. Its row is the
    // real one — read it back rather than failing a customer who is trying to
    // pay us.
    if (err?.code === "ER_DUP_ENTRY") {
      const winner = await findOpenAttempt(db, invoice.invoiceId, gateway.name);
      if (winner?.paymentUrl) {
        return { status: "reused", attempt: winner, paymentUrl: winner.paymentUrl };
      }
    }
    throw err;
  }
};

/**
 * Mark an attempt finished. Called by the webhook path once an outcome is known.
 *
 * Guarded on `status = 'pending'` so a late duplicate cannot reopen or rewrite
 * a settled attempt.
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {Object} args
 * @param {string} args.provider
 * @param {string} args.providerRef
 * @param {'paid'|'failed'|'expired'|'cancelled'} args.status
 * @param {string|null} [args.failureReason=null]
 * @returns {Promise<number>} rows affected.
 */
export const closeAttempt = async (
  conn,
  { provider, providerRef, status, failureReason = null }
) => {
  if (!providerRef) return 0;

  const [result] = await conn.execute(
    `UPDATE payment_attempts
        SET status = ?, failureReason = ?, dateUpdated = ?
      WHERE provider = ? AND providerRef = ? AND status = 'pending'`,
    [status, failureReason, getCurrentTimestampLocal(), provider, providerRef]
  );

  return result.affectedRows;
};

export default { findOpenAttempt, createPaymentForInvoice, closeAttempt };
