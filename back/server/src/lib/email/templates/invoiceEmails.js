import { formatAmount } from "../../money/money.js";

/**
 * Customer-facing email bodies.
 *
 * Plain functions returning `{ subject, html, text }`. Inline styles only —
 * email clients strip `<style>` blocks and know nothing about Tailwind — and a
 * plain-text alternative on every message, because some clients show that and
 * because a bill that renders as a blank page is a support call.
 *
 * A richer engine (MJML, React Email) can replace these behind the same
 * signature.
 */

/**
 * Escape text before it goes into HTML.
 *
 * Customer names, addresses and line descriptions are operator- and
 * customer-supplied. Interpolating them raw into an email body is how a stray
 * `&` mangles a name and how a `<` in a description silently eats the rest of
 * the invoice.
 *
 * @param {unknown} value
 * @returns {string}
 */
export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const amount = (v) => formatAmount(v ?? 0);
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");

const BRAND = "#1a1a1a";
const MUTED = "#6b7280";
const LINE = "#e5e5e5";

/** The shared shell: header, card, footer. Body content is already escaped. */
const shell = ({ companyName, bodyHtml, footerNote }) => `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;padding:28px;">
        <div style="margin-bottom:18px;">
          <span style="font-size:18px;font-weight:600;color:${BRAND};">${escapeHtml(companyName)}</span>
        </div>
        ${bodyHtml}
      </div>
      <p style="color:${MUTED};font-size:12px;text-align:center;margin:16px 0 0;">
        ${escapeHtml(footerNote)}
      </p>
    </div>
  </body>
</html>`;

const payButton = (payUrl) => `
  <div style="text-align:center;margin:22px 0;">
    <a href="${escapeHtml(payUrl)}"
       style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">
      Pay now
    </a>
  </div>
  <p style="color:${MUTED};font-size:12px;text-align:center;margin:0;word-break:break-all;">
    ${escapeHtml(payUrl)}
  </p>`;

const lineTable = (invoice) => {
  const rows = (invoice.lines || [])
    .map(
      (l) => `<tr>
        <td style="padding:6px 0;color:#353a3e;">${escapeHtml(l.description)}</td>
        <td style="padding:6px 0;text-align:right;color:${BRAND};">${escapeHtml(amount(l.amount))}</td>
      </tr>`
    )
    .join("");

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows}
      <tr>
        <td style="padding:10px 0 0;border-top:1px solid ${LINE};font-weight:600;color:${BRAND};">Total due</td>
        <td style="padding:10px 0 0;border-top:1px solid ${LINE};text-align:right;font-weight:700;color:${BRAND};">
          ${escapeHtml(amount(invoice.total))}
        </td>
      </tr>
    </table>`;
};

/**
 * The invoice itself, on the 15th. The PDF is attached; this is the summary.
 *
 * @param {Object} args
 * @param {Object} args.invoice with `lines`.
 * @param {{name: string, email: string}} args.customer
 * @param {string} args.payUrl
 * @param {string} [args.companyName="TERANETWORK"]
 * @returns {{subject: string, html: string, text: string}}
 */
export const buildInvoiceIssuedEmail = ({
  invoice,
  customer,
  payUrl,
  companyName = "TERANETWORK",
}) => {
  const subject = `Invoice ${invoice.invoiceNo} — ${amount(invoice.total)} due ${dateOnly(invoice.dueDate)}`;

  const bodyHtml = `
    <h1 style="font-size:18px;color:${BRAND};margin:0 0 4px;">Invoice ${escapeHtml(invoice.invoiceNo)}</h1>
    <p style="color:#353a3e;margin:0 0 16px;">
      Hi ${escapeHtml(customer.name)}, here is your bill for
      ${escapeHtml(dateOnly(invoice.billingPeriodStart))} – ${escapeHtml(dateOnly(invoice.billingPeriodEnd))}.
    </p>
    ${lineTable(invoice)}
    <p style="color:#353a3e;margin:16px 0;">
      Due date: <strong>${escapeHtml(dateOnly(invoice.dueDate))}</strong>
    </p>
    ${payButton(payUrl)}
    <p style="color:${MUTED};font-size:12px;margin:18px 0 0;">
      A PDF copy is attached. The payment link stays valid until this invoice is paid.
    </p>`;

  const text = [
    `Invoice ${invoice.invoiceNo}`,
    ``,
    `Hi ${customer.name}, here is your bill for ${dateOnly(invoice.billingPeriodStart)} – ${dateOnly(invoice.billingPeriodEnd)}.`,
    ``,
    ...(invoice.lines || []).map((l) => `  ${l.description}  ${amount(l.amount)}`),
    ``,
    `Total due: ${amount(invoice.total)}`,
    `Due date: ${dateOnly(invoice.dueDate)}`,
    ``,
    `Pay online: ${payUrl}`,
  ].join("\n");

  return {
    subject,
    html: shell({
      companyName,
      bodyHtml,
      footerNote: "You are receiving this because you have an active service with us.",
    }),
    text,
  };
};

/**
 * The three notices a customer gets about an unpaid invoice: the reminder ahead
 * of the due date, the last warning on the morning of the cut-off day, and the
 * overdue notice after the due date has passed.
 *
 * One function for all three because they differ only in tone and urgency — and
 * keeping them together is what stops one of them quietly drifting into saying
 * something another contradicts.
 *
 * @param {Object} args
 * @param {'reminder'|'final'|'overdue'} args.kind
 * @param {Object} args.invoice
 * @param {{name: string}} args.customer
 * @param {string} args.payUrl
 * @param {number} [args.graceDays] shapes the overdue notice's consequence line;
 *   0 means the disconnection has already happened by the time it is read.
 * @param {number} [args.cutOffHour] the hour the sweep runs, named on the final
 *   notice so "today" has a deadline attached to it.
 * @param {string} [args.companyName="TERANETWORK"]
 * @returns {{subject: string, html: string, text: string}}
 */
export const buildInvoiceNoticeEmail = ({
  kind,
  invoice,
  customer,
  payUrl,
  graceDays = null,
  cutOffHour = null,
  companyName = "TERANETWORK",
}) => {
  const due = dateOnly(invoice.dueDate);
  const total = amount(invoice.total);

  // ── What each notice is for ───────────────────────────────────────────────
  //
  //   reminder  days ahead of the due date — a nudge, no consequence stated
  //   final     the morning of the cut-off day — the last chance, with the hour
  //   overdue   after the due date has passed — the status, and what it means
  //
  // The consequence is said plainly, and only where it is actually true. A
  // vague "service may be affected" is worse than either saying nothing or
  // saying exactly what will happen and when.
  const COPY = {
    reminder: {
      subject: `Reminder: invoice ${invoice.invoiceNo} is due ${due}`,
      heading: "Your invoice is due soon",
      lead: `invoice ${invoice.invoiceNo} for ${total} is due on ${due}.`,
      consequence: null,
    },
    final: {
      subject: `Last notice: invoice ${invoice.invoiceNo} — ${total}`,
      heading: "Last notice before your service is suspended",
      lead: `invoice ${invoice.invoiceNo} for ${total} was due on ${due} and is still unpaid.`,
      consequence: Number.isFinite(cutOffHour)
        ? `If payment is not received by ${String(cutOffHour).padStart(2, "0")}:00 today, your connection will be suspended until it is.`
        : `If payment is not received today, your connection will be suspended until it is.`,
    },
    overdue: {
      subject: `Overdue: invoice ${invoice.invoiceNo} — ${total}`,
      heading: "Your invoice is past due",
      lead: `invoice ${invoice.invoiceNo} for ${total} was due on ${due}.`,
      // With no grace period the disconnection sweep has already run by the
      // time this goes out, so the old "within 0 days" wording was both
      // nonsense and late. It does not claim this customer IS suspended —
      // an exemption or a missing modem can mean they are not, and a notice
      // that tells someone their service is off when it is on costs a call.
      consequence:
        graceDays === 0
          ? `Service is suspended while an invoice is past due. Once this is paid your connection is restored automatically — there is no need to call.`
          : Number.isFinite(graceDays)
            ? `If this is not settled within ${graceDays} day${graceDays === 1 ? "" : "s"} of the due date, your connection will be suspended until payment is received.`
            : null,
    },
  };

  const copy = COPY[kind] ?? COPY.reminder;

  const consequenceHtml = copy.consequence
    ? `<p style="color:#b45309;margin:0 0 16px;">${escapeHtml(copy.consequence)}</p>`
    : "";

  const bodyHtml = `
    <h1 style="font-size:18px;color:${BRAND};margin:0 0 4px;">${copy.heading}</h1>
    <p style="color:#353a3e;margin:0 0 16px;">
      Hi ${escapeHtml(customer.name)}, ${escapeHtml(copy.lead)}
    </p>
    ${consequenceHtml}
    ${payButton(payUrl)}
    <p style="color:${MUTED};font-size:12px;margin:18px 0 0;">
      If you have already paid, please ignore this message — payments can take a short
      while to appear.
    </p>`;

  const text = [
    copy.heading,
    ``,
    `Hi ${customer.name}, ${copy.lead}`,
    ...(copy.consequence ? [``, copy.consequence] : []),
    ``,
    `Pay online: ${payUrl}`,
    ``,
    `If you have already paid, please ignore this message.`,
  ].join("\n");

  const subject = copy.subject;

  return {
    subject,
    html: shell({
      companyName,
      bodyHtml,
      footerNote: "This is an automated billing notice.",
    }),
    text,
  };
};

/**
 * The receipt, sent when a payment settles an invoice.
 *
 * @param {Object} args
 * @param {Object} args.invoice
 * @param {{name: string}} args.customer
 * @param {{amount: number|string, channel: string, paidAt: string}} args.payment
 * @param {boolean} [args.reconnecting=false] whether service is being restored.
 * @param {string} [args.companyName="TERANETWORK"]
 * @returns {{subject: string, html: string, text: string}}
 */
export const buildPaymentReceivedEmail = ({
  invoice,
  customer,
  payment,
  reconnecting = false,
  companyName = "TERANETWORK",
}) => {
  const subject = `Payment received — invoice ${invoice.invoiceNo}`;

  const reconnectNote = reconnecting
    ? `<p style="color:#15803d;margin:0 0 16px;">
         Your connection is being restored now. It should be back within a few minutes.
       </p>`
    : "";

  const bodyHtml = `
    <h1 style="font-size:18px;color:${BRAND};margin:0 0 4px;">Thank you — payment received</h1>
    <p style="color:#353a3e;margin:0 0 16px;">
      Hi ${escapeHtml(customer.name)}, we have received
      <strong>${escapeHtml(amount(payment.amount))}</strong> for invoice
      ${escapeHtml(invoice.invoiceNo)}.
    </p>
    ${reconnectNote}
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:6px 0;color:${MUTED};">Paid on</td>
        <td style="padding:6px 0;text-align:right;color:${BRAND};">
          ${escapeHtml(dateOnly(payment.paidAt))}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${MUTED};">Method</td>
        <td style="padding:6px 0;text-align:right;color:${BRAND};">
          ${escapeHtml(payment.channel)}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${MUTED};">Billing period</td>
        <td style="padding:6px 0;text-align:right;color:${BRAND};">
          ${escapeHtml(dateOnly(invoice.billingPeriodStart))} – ${escapeHtml(dateOnly(invoice.billingPeriodEnd))}
        </td>
      </tr>
    </table>`;

  const text = [
    `Thank you — payment received`,
    ``,
    `Hi ${customer.name}, we have received ${amount(payment.amount)} for invoice ${invoice.invoiceNo}.`,
    ...(reconnecting ? [``, `Your connection is being restored now.`] : []),
    ``,
    `Paid on: ${dateOnly(payment.paidAt)}`,
    `Method: ${payment.channel}`,
  ].join("\n");

  return {
    subject,
    html: shell({ companyName, bodyHtml, footerNote: "Keep this message as your receipt." }),
    text,
  };
};

export default {
  escapeHtml,
  buildInvoiceIssuedEmail,
  buildInvoiceNoticeEmail,
  buildPaymentReceivedEmail,
};
