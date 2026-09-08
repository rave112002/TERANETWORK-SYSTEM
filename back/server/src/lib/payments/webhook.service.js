import { closeAttempt } from "./payment.service.js";
import { settleInvoice } from "../billing/settlement.service.js";
import { cancel } from "../jobs/jobs.queue.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";
import { logger } from "../../../config/logger.js";
import { systemAuditContext } from "../../utils/audit.js";

/**
 * Turning a verified callback into money received.
 *
 * ── This file contains no provider names ────────────────────────────────────
 *
 * By the time anything here runs, the adapter has already verified the
 * signature and normalised the payload. What is left is the part that must be
 * identical whoever collects: record the event, refuse to process it twice,
 * settle the invoice through the same function the cash counter uses, and get
 * the customer back online.
 *
 * That last step is the reason this is worth doing carefully. A payment that
 * settles but does not reconnect leaves somebody who has paid without internet,
 * and they will not find out until they call.
 */

/**
 * Record a callback before acting on it, and say whether it still needs work.
 *
 * The UNIQUE(provider, eventId) index is the guard, not a preceding SELECT: two
 * retries can arrive in the same millisecond and both would pass a check before
 * either inserted. Only one can win an index.
 *
 * A duplicate is not automatically "already handled". If an earlier attempt
 * recorded the event and then failed, `processedAt` is still NULL and the
 * gateway's retry must be let through — otherwise the row written for safety
 * permanently blocks the retry that would have fixed it.
 *
 * @param {Object} db
 * @param {Object} args
 * @param {string} args.provider
 * @param {string} args.eventId
 * @param {string|null} args.eventType
 * @param {string|null} args.reference
 * @param {boolean} args.signatureVerified
 * @param {Object} args.payload
 * @returns {Promise<{webhookEventId: string|null, isDuplicate: boolean, alreadyProcessed: boolean}>}
 */
export const recordWebhookEvent = async (
  db,
  { provider, eventId, eventType = null, reference = null, signatureVerified, payload }
) => {
  const now = getCurrentTimestampLocal();

  try {
    const [uuidRow] = await db.query(`SELECT UUID() AS id`);
    const webhookEventId = uuidRow.id;

    await db.query(
      `INSERT INTO webhook_events
         (webhookEventId, provider, eventId, eventType, reference,
          signatureVerified, payload, dateCreated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        webhookEventId,
        provider,
        eventId,
        eventType,
        reference,
        signatureVerified ? 1 : 0,
        JSON.stringify(payload ?? {}),
        now,
      ]
    );

    return { webhookEventId, isDuplicate: false, alreadyProcessed: false };
  } catch (err) {
    if (err?.code !== "ER_DUP_ENTRY") throw err;

    const rows = await db.query(
      `SELECT webhookEventId, processedAt FROM webhook_events
        WHERE provider = ? AND eventId = ? LIMIT 1`,
      [provider, eventId]
    );

    return {
      webhookEventId: rows[0]?.webhookEventId ?? null,
      isDuplicate: true,
      alreadyProcessed: Boolean(rows[0]?.processedAt),
    };
  }
};

/** Stamp an event handled. */
export const markEventProcessed = async (db, webhookEventId, invoiceId = null) => {
  if (!webhookEventId) return;
  await db.query(
    `UPDATE webhook_events
        SET processedAt = ?, processError = NULL, invoiceId = COALESCE(?, invoiceId)
      WHERE webhookEventId = ?`,
    [getCurrentTimestampLocal(), invoiceId, webhookEventId]
  );
};

/** Record why an event failed, leaving processedAt NULL so a retry may run. */
export const markEventFailed = async (db, webhookEventId, message) => {
  if (!webhookEventId) return;
  await db.query(`UPDATE webhook_events SET processError = ? WHERE webhookEventId = ?`, [
    String(message).slice(0, 2000),
    webhookEventId,
  ]);
};

/**
 * Apply a paid callback.
 *
 * @param {Object} db
 * @param {string} provider
 * @param {import('../payment-gateways/gateway.interface.js').WebhookEvent} event
 * @returns {Promise<{outcome: string, invoiceNo?: string, invoiceId?: string}>}
 */
const applyPaidEvent = async (db, provider, event) => {
  const rows = await db.query(
    `SELECT i.invoiceId, i.invoiceNo, i.total, i.status, i.companyId, i.branchId,
            s.subscriptionId, s.status AS subscriptionStatus, s.onuId
       FROM invoices i
       JOIN subscriptions s ON s.subscriptionId = i.subscriptionId
      WHERE i.invoiceNo = ? LIMIT 1`,
    [event.reference]
  );

  const invoice = rows[0];
  if (!invoice) {
    // Not fixable by retrying, so it is recorded as handled and the gateway is
    // told to stop resending. Reconciliation surfaces it for a person.
    logger.error(`🚨 [webhook] ${provider}: no invoice matches reference '${event.reference}'`);
    return { outcome: "invoice_not_found" };
  }

  // Cancel a queued disconnection BEFORE settling. A payment landing seconds
  // before the dunning worker claims its ticket must not result in a customer
  // who has just paid being cut off. The worker's own precondition re-check is
  // the backstop for one already in flight.
  if (invoice.onuId) {
    let conn;
    try {
      conn = await db.beginTransaction();
      const cancelled = await cancel(
        conn,
        `deactivate:onu:${invoice.onuId}`,
        "payment received"
      );
      await db.commit(conn);
      if (cancelled > 0) {
        logger.info(
          `[webhook] ${provider}: cancelled ${cancelled} queued disconnect for ${invoice.invoiceNo}`
        );
      }
    } catch (err) {
      if (conn) await db.rollback(conn);
      // Not fatal. The worker re-checks its preconditions before touching a
      // device, so a disconnect that survives this will still find the invoice
      // paid and stand down. Settling the money matters more than tidying the
      // queue, so this must not abort the payment.
      logger.warn(`[webhook] ${provider}: could not cancel queued disconnect: ${err.message}`);
    }
  }

  const settlement = await settleInvoice(db, {
    invoiceId: invoice.invoiceId,
    // What actually arrived, not what was asked for — so an underpayment is
    // caught by the exact-amount rule instead of quietly accepted.
    amount: event.amount ?? invoice.total,
    channel: event.channel || provider.toUpperCase(),
    providerPaymentId: event.providerPaymentId ?? event.providerRef,
    provider,
    paidAt: event.paidAt ?? null,
    rawPayload: event.raw,
    context: systemAuditContext(`payment:${provider}`, {
      companyId: invoice.companyId,
      branchId: invoice.branchId,
    }),
  });

  if (settlement.status === "amount_mismatch") {
    // Deliberately not marked paid — there are no partial payments. Loud,
    // because this is money received that is not resolving a bill, and only a
    // person can decide what to do about it.
    logger.error(
      `🚨 [webhook] ${provider}: amount mismatch on ${invoice.invoiceNo} — ` +
        `expected ${settlement.expected}, received ${settlement.got}`
    );
    return { outcome: "amount_mismatch", invoiceNo: invoice.invoiceNo, invoiceId: invoice.invoiceId };
  }

  if (settlement.status !== "paid" && settlement.status !== "already_paid") {
    logger.warn(
      `[webhook] ${provider}: ${invoice.invoiceNo} not settled (${settlement.status})`
    );
    return { outcome: settlement.status, invoiceNo: invoice.invoiceNo, invoiceId: invoice.invoiceId };
  }

  // Close the attempt this settles. Best-effort and after settlement: the
  // money is the fact, the attempt row is bookkeeping, and failing to update
  // the latter must never undo the former.
  if (event.providerRef) {
    let conn;
    try {
      conn = await db.beginTransaction();
      await closeAttempt(conn, {
        provider,
        providerRef: event.providerRef,
        status: "paid",
      });
      await db.commit(conn);
    } catch (err) {
      if (conn) await db.rollback(conn);
      logger.warn(`[webhook] ${provider}: could not close attempt: ${err.message}`);
    }
  }

  // settleInvoice already queues the reconnection when this clears the last
  // debt, and only then — paying one of three overdue invoices must not buy
  // back service the next dunning sweep would cut again. Said out loud here
  // because it is the step whose absence nobody notices until a customer calls.
  if (settlement.reconnectQueued) {
    logger.info(
      `[webhook] ${provider}: ${invoice.invoiceNo} paid — reconnection queued for ONU ${invoice.onuId}`
    );
  }

  return {
    outcome: settlement.status,
    invoiceNo: invoice.invoiceNo,
    invoiceId: invoice.invoiceId,
  };
};

/**
 * Apply a failed or expired callback.
 *
 * Nothing happens to the invoice. A failed attempt is not a failed bill: the
 * customer can try again on the same link, and marking anything on the invoice
 * would misrepresent an abandoned checkout as a refusal to pay.
 */
const applyClosingEvent = async (db, provider, event, status) => {
  if (!event.providerRef) return { outcome: `ignored:${status}` };

  let conn;
  try {
    conn = await db.beginTransaction();
    await closeAttempt(conn, {
      provider,
      providerRef: event.providerRef,
      status,
      failureReason: event.eventType ?? null,
    });
    await db.commit(conn);
  } catch (err) {
    if (conn) await db.rollback(conn);
    throw err;
  }

  return { outcome: status };
};

/**
 * Handle one verified, normalised callback.
 *
 * @param {Object} db
 * @param {string} provider
 * @param {import('../payment-gateways/gateway.interface.js').WebhookEvent} event
 * @param {Object} [opts]
 * @param {boolean} [opts.signatureVerified=true]
 * @returns {Promise<{handled: boolean, outcome: string, retryable: boolean}>}
 *   `retryable` tells the controller whether to answer 500 — which makes the
 *   gateway resend — or 200, which stops it.
 */
export const processWebhookEvent = async (db, provider, event, { signatureVerified = true } = {}) => {
  const { webhookEventId, isDuplicate, alreadyProcessed } = await recordWebhookEvent(db, {
    provider,
    eventId: event.eventId,
    eventType: event.eventType,
    reference: event.reference,
    signatureVerified,
    payload: event.raw,
  });

  if (isDuplicate && alreadyProcessed) {
    logger.info(`[webhook] ${provider}: duplicate ${event.eventId} already handled`);
    return { handled: false, outcome: "duplicate", retryable: false };
  }
  if (isDuplicate) {
    logger.warn(`[webhook] ${provider}: retrying previously-failed event ${event.eventId}`);
  }

  try {
    let result;

    switch (event.outcome) {
      case "paid":
        result = await applyPaidEvent(db, provider, event);
        break;
      case "failed":
        result = await applyClosingEvent(db, provider, event, "failed");
        break;
      case "expired":
        result = await applyClosingEvent(db, provider, event, "expired");
        break;
      default:
        // Recorded, not acted on. A gateway sends more event types than we
        // model, and guessing at an unrecognised one is how a "pending" is
        // mistaken for a payment.
        logger.info(
          `[webhook] ${provider}: recorded '${event.eventType}' for ${event.reference} (no action)`
        );
        result = { outcome: `ignored:${event.eventType}` };
    }

    await markEventProcessed(db, webhookEventId, result.invoiceId ?? null);
    return { handled: true, outcome: result.outcome, retryable: false };
  } catch (err) {
    // processedAt stays NULL so the gateway's retry is allowed through.
    await markEventFailed(db, webhookEventId, err.message);
    logger.error(`🚨 [webhook] ${provider}: processing ${event.eventId} failed: ${err.message}`);
    return { handled: false, outcome: "error", retryable: true };
  }
};

export default {
  recordWebhookEvent,
  markEventProcessed,
  markEventFailed,
  processWebhookEvent,
};
