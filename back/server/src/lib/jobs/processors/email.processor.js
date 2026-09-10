import fs from "node:fs/promises";

import {
  buildInvoiceIssuedEmail,
  buildInvoiceNoticeEmail,
  buildPaymentReceivedEmail,
} from "../../email/templates/invoiceEmails.js";
import { ensureInvoicePdf, loadInvoiceForRender } from "../../billing/invoice.render.js";
import { buildPayUrl } from "../../qr/payQr.js";
import { getBillingSchedule } from "../../settings/settings.service.js";
import { recordEmailEvent, sendEmail } from "../../email/email.service.js";

/**
 * The email job processor.
 *
 * Registered for the `email` job type. `job.payload.kind` selects the message:
 * `invoice_issued`, `reminder`, `final`, `overdue`, `payment_received`.
 *
 * ── What throwing means here ────────────────────────────────────────────────
 *
 * Throwing puts the job back on the queue with backoff, so it must only be done
 * for failures a retry could fix — SMTP refusing the connection, the mail
 * server timing out. A customer with no email address is not that: retrying
 * five times will not give them one, so it returns a skipped result and the job
 * completes. Either way an `email_events` row is written first, so the trail
 * says what was attempted and why it did not arrive.
 */

/** Templates, by payload kind. */
const RENDERERS = {
  invoice_issued: ({ invoice, customer, payUrl, companyName }) =>
    buildInvoiceIssuedEmail({ invoice, customer, payUrl, companyName }),
  reminder: ({ invoice, customer, payUrl, companyName }) =>
    buildInvoiceNoticeEmail({ kind: "reminder", invoice, customer, payUrl, companyName }),
  final: ({ invoice, customer, payUrl, companyName, cutOffHour }) =>
    buildInvoiceNoticeEmail({
      kind: "final",
      invoice,
      customer,
      payUrl,
      cutOffHour,
      companyName,
    }),
  overdue: ({ invoice, customer, payUrl, companyName, graceDays }) =>
    buildInvoiceNoticeEmail({
      kind: "overdue",
      invoice,
      customer,
      payUrl,
      graceDays,
      companyName,
    }),
  payment_received: ({ invoice, customer, payment, reconnecting, companyName }) =>
    buildPaymentReceivedEmail({ invoice, customer, payment, reconnecting, companyName }),
};

/**
 * Every kind this processor can send.
 *
 * Exported so a test can hold it against the `email_events.type` ENUM. Adding a
 * renderer without widening that column sends the email and then fails on the
 * INSERT that records it — after the message has left, so the job retries and
 * the customer receives it again. Migration 012 exists because of exactly that.
 */
export const EMAIL_KINDS = Object.keys(RENDERERS);

/**
 * The kinds that chase an unpaid invoice. They share two behaviours: none of
 * them may be sent for an invoice that has since been paid, and each needs the
 * billing schedule to say what happens next.
 */
const CHASING_KINDS = new Set(["reminder", "final", "overdue"]);

/**
 * Process one `email` job.
 *
 * @param {Object} job from the queue; `payload.kind` and `payload.invoiceId`.
 * @param {{db: Object, logger: Object}} ctx
 * @returns {Promise<Object>} a summary stored on the job.
 */
export const emailProcessor = async (job, { db, logger }) => {
  const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : (job.payload ?? {});
  const { kind, invoiceId } = payload;

  const render = RENDERERS[kind];
  if (!render) {
    // Unfixable by retrying — straight to the dead letter rather than burning
    // five attempts on a payload nobody can handle.
    throw new Error(`Unknown email kind '${kind}'`);
  }

  if (!invoiceId) throw new Error(`Email job payload has no invoiceId`);

  const loaded = await loadInvoiceForRender(db, invoiceId);
  if (!loaded) {
    logger.warn(`[email] invoice ${invoiceId} no longer exists — skipping`, { jobId: job.jobId });
    return { skipped: true, reason: "the invoice no longer exists" };
  }

  const { invoice, customer, company } = loaded;

  // A voided invoice must not be chased for payment. This can genuinely happen:
  // the job was queued on the 15th and voided before the worker got to it.
  if (invoice.status === "void" && kind !== "payment_received") {
    logger.info(`[email] invoice ${invoice.invoiceNo} is void — not sending ${kind}`, {
      jobId: job.jobId,
    });
    return { skipped: true, reason: "the invoice was voided" };
  }

  // Nor should a paid invoice get a reminder or an overdue notice — the same
  // race, from the other direction.
  if (invoice.status === "paid" && CHASING_KINDS.has(kind)) {
    logger.info(`[email] invoice ${invoice.invoiceNo} is already paid — not sending ${kind}`, {
      jobId: job.jobId,
    });
    return { skipped: true, reason: "the invoice was already paid" };
  }

  if (!customer.email) {
    await recordEmailEvent(db, {
      companyId: invoice.companyId,
      invoiceId,
      customerId: invoice.customerId,
      type: kind,
      recipient: "(none)",
      providerStatus: "failed",
      error: "The customer has no email address on file",
    });
    logger.warn(`[email] customer ${customer.accountNo} has no email — skipping`, {
      jobId: job.jobId,
    });
    return { skipped: true, reason: "the customer has no email address" };
  }

  const payUrl = buildPayUrl(invoice.publicToken);

  // The two notices that state a consequence need the schedule to state it
  // correctly: the overdue notice reads differently with no grace period, and
  // the final notice names the hour the sweep runs.
  const schedule = CHASING_KINDS.has(kind) ? await getBillingSchedule(db, invoice.companyId) : null;

  const message = render({
    invoice,
    customer,
    payUrl,
    companyName: company.name || "TERANETWORK",
    graceDays: schedule?.graceDays ?? null,
    cutOffHour: schedule?.dunningHour ?? null,
    payment: payload.payment ?? null,
    reconnecting: Boolean(payload.reconnecting),
  });

  // The PDF rides along on the invoice itself, and on nothing else: a reminder
  // is a nudge, and re-attaching the whole bill to it just makes the message
  // heavier and more likely to be filtered.
  const attachments = [];
  if (kind === "invoice_issued") {
    try {
      const pdfPath = await ensureInvoicePdf(db, invoice);
      attachments.push({
        filename: `${invoice.invoiceNo}.pdf`,
        content: await fs.readFile(pdfPath),
        contentType: "application/pdf",
      });
    } catch (err) {
      // Send the email without it rather than not at all. The summary and the
      // pay link are the parts the customer actually needs; the PDF is
      // downloadable from the payment page.
      logger.error(`[email] could not attach PDF for ${invoice.invoiceNo}: ${err.message}`, {
        jobId: job.jobId,
      });
    }
  }

  try {
    const { messageId } = await sendEmail({
      to: customer.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments,
    });

    await recordEmailEvent(db, {
      companyId: invoice.companyId,
      invoiceId,
      customerId: invoice.customerId,
      type: kind,
      recipient: customer.email,
      subject: message.subject,
      providerMsgId: messageId,
      providerStatus: "sent",
    });

    return {
      sent: true,
      to: customer.email,
      subject: message.subject,
      attachedPdf: attachments.length > 0,
    };
  } catch (err) {
    await recordEmailEvent(db, {
      companyId: invoice.companyId,
      invoiceId,
      customerId: invoice.customerId,
      type: kind,
      recipient: customer.email,
      subject: message.subject,
      providerStatus: "failed",
      error: err.message,
    });
    // Rethrown so the queue retries: a refused SMTP connection usually is
    // temporary, and the event row above already records the attempt.
    throw err;
  }
};

export default emailProcessor;
