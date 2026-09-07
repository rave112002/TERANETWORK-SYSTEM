import { computeTotalsFromLines } from "./invoice.calc.js";
import { enqueue } from "../jobs/jobs.queue.js";
import { amountsEqual, toAmount } from "../money/money.js";
import { writeAudit, systemAuditContext } from "../../utils/audit.js";
import { getCurrentTimestampLocal, toTimestampLocal } from "../../utils/dateUtils.js";

/**
 * Payment settlement.
 *
 * `settleInvoice()` is the ONE transaction that both the manual-payment
 * endpoint and the Xendit webhook call. Keeping it in a single place is what
 * stops the two paths drifting: a cash payment and a GCash payment mark an
 * invoice paid by exactly the same code, with the same guarantees.
 *
 *   - Idempotent. A replayed webhook is a no-op, not a second payment.
 *   - Exact amount. No partial payments, by client decision.
 *   - The invoice flips to 'paid' inside the same transaction as the payment
 *     row, the audit entry, and the reconnection job — so there is no window in
 *     which the money is recorded and the service is not restored.
 */

/**
 * Recompute an invoice's totals from its current lines, on the caller's
 * connection. Call after adding or removing an adjustment line.
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} invoiceId
 * @param {number} [vatRate=0]
 * @returns {Promise<{subtotal: string, fees: string, tax: string, total: string}>}
 */
export const recomputeInvoiceTotals = async (conn, invoiceId, vatRate = 0) => {
  const [lines] = await conn.execute(
    `SELECT kind, amount FROM invoice_lines WHERE invoiceId = ?`,
    [invoiceId]
  );

  const totals = computeTotalsFromLines(lines, vatRate);

  await conn.execute(
    `UPDATE invoices SET subtotal = ?, fees = ?, tax = ?, total = ?, dateUpdated = ?
      WHERE invoiceId = ?`,
    [totals.subtotal, totals.fees, totals.tax, totals.total, getCurrentTimestampLocal(), invoiceId]
  );

  return totals;
};

/**
 * Queue a reconnection when this payment clears the customer's last debt.
 *
 * Restoring service is not a staff action (decision D6): a suspended customer
 * who pays gets their connection back because they paid, not because someone
 * remembered to press a button. So the job goes on the same transaction as the
 * payment — if the money is recorded, the reconnection is queued.
 *
 * It only fires when NOTHING is still owed. Reconnecting a customer who paid
 * one of three overdue invoices would restore service they have not paid for,
 * and the next dunning sweep would cut them off again the same day.
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {Object} invoice the locked invoice row.
 * @returns {Promise<boolean>} whether a job was queued.
 */
const queueReconnectionIfSettled = async (conn, invoice) => {
  const [subs] = await conn.execute(
    `SELECT subscriptionId, status, onuId FROM subscriptions
      WHERE subscriptionId = ? LIMIT 1`,
    [invoice.subscriptionId]
  );

  const sub = subs[0];
  if (!sub || sub.status !== "suspended" || !sub.onuId) return false;

  const [outstanding] = await conn.execute(
    `SELECT COUNT(*) AS n FROM invoices
      WHERE subscriptionId = ? AND status IN ('issued', 'overdue')`,
    [invoice.subscriptionId]
  );
  if (Number(outstanding[0].n) > 0) return false;

  await enqueue(conn, {
    companyId: invoice.companyId,
    branchId: invoice.branchId,
    type: "activate",
    payload: {
      onuId: sub.onuId,
      reason: "payment",
      triggeredBy: "system:payment",
      invoiceId: invoice.invoiceId,
    },
    // Per invoice, not per subscription: a customer who is suspended, pays, is
    // suspended again next month and pays again needs two reconnections.
    dedupeKey: `activate:payment:${invoice.invoiceId}`,
  });

  return true;
};

/**
 * Record a payment against an invoice and mark it paid.
 *
 * @param {Object} db the `Database` wrapper.
 * @param {Object} args
 * @param {string} args.invoiceId
 * @param {number|string} args.amount must equal the invoice total exactly.
 * @param {string} args.channel e.g. 'CASH', 'GCASH', 'QRPH'.
 * @param {string|null} [args.xenditPaymentId=null] set for gateway payments; the dedupe key.
 * @param {string|null} [args.recordedBy=null] staff accountId, for manual entries.
 * @param {Date|string} [args.paidAt] defaults to now, Manila local.
 * @param {Object|null} [args.rawPayload=null] the gateway's original payload.
 * @param {Object|null} [args.context=null] audit context; defaults to a system actor.
 * @returns {Promise<{status: string, paymentId?: string, expected?: string, got?: string, reconnectQueued?: boolean}>}
 *   status ∈ 'paid' | 'already_paid' | 'duplicate' | 'not_found' | 'void' | 'amount_mismatch'
 */
export const settleInvoice = async (
  db,
  {
    invoiceId,
    amount,
    channel,
    xenditPaymentId = null,
    recordedBy = null,
    paidAt = null,
    rawPayload = null,
    context = null,
  }
) => {
  let conn;
  try {
    conn = await db.beginTransaction();

    // Locked, so two settlements of the same invoice serialise rather than both
    // seeing it unpaid.
    const [rows] = await conn.execute(
      `SELECT invoiceId, companyId, branchId, subscriptionId, customerId,
              invoiceNo, total, status
         FROM invoices WHERE invoiceId = ? FOR UPDATE`,
      [invoiceId]
    );

    const invoice = rows[0];
    if (!invoice) {
      await db.rollback(conn);
      return { status: "not_found" };
    }

    // Idempotency: this gateway payment is already recorded.
    //
    // Checked BEFORE the paid/void checks, because a replayed webhook for an
    // invoice that is already paid must report 'duplicate' — that is the answer
    // that tells the caller to stop retrying.
    if (xenditPaymentId) {
      const [dup] = await conn.execute(
        `SELECT paymentId FROM payments WHERE xenditPaymentId = ? LIMIT 1`,
        [xenditPaymentId]
      );
      if (dup.length > 0) {
        await db.commit(conn);
        return { status: "duplicate", paymentId: dup[0].paymentId };
      }
    }

    if (invoice.status === "paid") {
      await db.commit(conn);
      return { status: "already_paid" };
    }
    if (invoice.status === "void") {
      await db.rollback(conn);
      return { status: "void" };
    }

    // No partial payments. Compared at 2dp through decimal.js, because a
    // float comparison here either rejects a correct payment or accepts one a
    // centavo short — and the consequence of both is somebody's internet.
    if (!amountsEqual(amount, invoice.total)) {
      await db.rollback(conn);
      return {
        status: "amount_mismatch",
        expected: toAmount(invoice.total),
        got: toAmount(amount),
      };
    }

    const now = getCurrentTimestampLocal();
    const paidAtValue = paidAt ? toTimestampLocal(paidAt) : now;

    const [uuidRow] = await conn.execute(`SELECT UUID() AS id`);
    const paymentId = uuidRow[0].id;

    await conn.execute(
      `INSERT INTO payments
         (paymentId, companyId, branchId, invoiceId, customerId, amount, channel,
          xenditPaymentId, recordedBy, paidAt, rawPayload, dateCreated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        invoice.companyId,
        invoice.branchId,
        invoiceId,
        invoice.customerId,
        toAmount(amount),
        channel,
        xenditPaymentId,
        recordedBy,
        paidAtValue,
        rawPayload ? JSON.stringify(rawPayload) : null,
        now,
      ]
    );

    await conn.execute(
      `UPDATE invoices
          SET status = 'paid', amountPaid = ?, paidAt = ?, dateUpdated = ?
        WHERE invoiceId = ?`,
      [toAmount(amount), paidAtValue, now, invoiceId]
    );

    const auditContext =
      context ??
      systemAuditContext("payment", {
        companyId: invoice.companyId,
        branchId: invoice.branchId,
      });

    await writeAudit(conn, {
      context: auditContext,
      module: "billing",
      action: "payment_recorded",
      description: `${channel} payment for invoice ${invoice.invoiceNo}`,
      before: { status: invoice.status },
      after: { status: "paid", amount: toAmount(amount), channel, paymentId },
    });

    const reconnectQueued = await queueReconnectionIfSettled(conn, invoice);

    await db.commit(conn);
    return { status: "paid", paymentId, reconnectQueued };
  } catch (err) {
    if (conn) await db.rollback(conn);
    // Two settlements racing on the same gateway payment: the unique key caught
    // the second one, which is the same answer the pre-check would have given.
    if (err?.code === "ER_DUP_ENTRY") return { status: "duplicate" };
    throw err;
  }
};

/**
 * Void an invoice. The row survives — voiding is a statement about a document
 * that existed, and deleting it would leave a hole in the invoice numbering
 * that nobody can explain a year later.
 *
 * @param {Object} db
 * @param {Object} args
 * @param {string} args.invoiceId
 * @param {string} args.reason
 * @param {Object} args.context audit context.
 * @returns {Promise<{status: 'voided'|'not_found'|'already_paid'|'already_void'}>}
 */
export const voidInvoice = async (db, { invoiceId, reason, context }) => {
  let conn;
  try {
    conn = await db.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT invoiceId, invoiceNo, status FROM invoices WHERE invoiceId = ? FOR UPDATE`,
      [invoiceId]
    );

    const invoice = rows[0];
    if (!invoice) {
      await db.rollback(conn);
      return { status: "not_found" };
    }
    if (invoice.status === "paid") {
      await db.rollback(conn);
      return { status: "already_paid" };
    }
    if (invoice.status === "void") {
      await db.rollback(conn);
      return { status: "already_void" };
    }

    const now = getCurrentTimestampLocal();
    await conn.execute(
      `UPDATE invoices SET status = 'void', voidReason = ?, dateUpdated = ? WHERE invoiceId = ?`,
      [reason, now, invoiceId]
    );

    // Release the charges this invoice carried, so they land on the next one
    // instead of vanishing with the voided document.
    await conn.execute(
      `UPDATE pending_charges
          SET appliedInvoiceId = NULL, appliedAt = NULL, dateUpdated = ?
        WHERE appliedInvoiceId = ?`,
      [now, invoiceId]
    );

    await writeAudit(conn, {
      context,
      module: "billing",
      action: "invoice_voided",
      description: `Voided invoice ${invoice.invoiceNo}: ${reason}`,
      before: { status: invoice.status },
      after: { status: "void", voidReason: reason },
    });

    await db.commit(conn);
    return { status: "voided" };
  } catch (err) {
    if (conn) await db.rollback(conn);
    throw err;
  }
};

export default { recomputeInvoiceTotals, settleInvoice, voidInvoice };
