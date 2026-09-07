import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

import { logger } from "../../../config/logger.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";

/**
 * The one `sendEmail()` interface. Every notification goes through it, so
 * changing provider is a config change and never a business-logic change.
 *
 * Transport selection:
 *   - `SMTP_HOST` set → real SMTP (Brevo, Gmail app password, SES…).
 *   - otherwise → nodemailer's jsonTransport, which sends nothing, plus the
 *     rendered HTML written to `logs/emails/` so the email can actually be
 *     looked at.
 *
 * The dev fallback is deliberate: an unconfigured machine should be able to run
 * a billing cycle end to end. The alternative — throwing when SMTP is missing —
 * makes the queue dead-letter every email job on a fresh checkout and teaches
 * everyone to ignore red jobs.
 */

let transporter = null;

const getTransport = () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
      // true for 465, false for 587 with STARTTLS.
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    logger.info(`[email] transport: SMTP ${process.env.SMTP_HOST}`);
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    logger.warn("[email] no SMTP_HOST configured — writing previews to logs/emails instead");
  }

  return transporter;
};

/** Whether a real transport is configured. Reported by the health endpoint. */
export const isEmailConfigured = () => Boolean(process.env.SMTP_HOST);

/**
 * Send one email.
 *
 * @param {Object} args
 * @param {string} args.to
 * @param {string} args.subject
 * @param {string} [args.html]
 * @param {string} [args.text]
 * @param {Array} [args.attachments] nodemailer attachment objects.
 * @returns {Promise<{messageId: string, preview: string|null}>}
 */
export const sendEmail = async ({ to, subject, html, text, attachments }) => {
  const from = process.env.MAIL_FROM || "TERANETWORK <no-reply@teranetwork.ph>";
  const info = await getTransport().sendMail({ from, to, subject, html, text, attachments });

  if (isEmailConfigured()) {
    logger.info(`[email] sent "${subject}" → ${to}`, { messageId: info.messageId });
    return { messageId: info.messageId, preview: null };
  }

  // Dev: persist the rendered body so it can be opened in a browser.
  try {
    const dir = path.resolve(process.cwd(), "logs", "emails");
    fs.mkdirSync(dir, { recursive: true });
    const safeTo = String(to).replace(/[^a-z0-9]/gi, "_");
    const file = path.join(dir, `${Date.now()}-${safeTo}.html`);
    fs.writeFileSync(file, html || text || "");
    logger.info(`[email:dev] "${subject}" → ${to} (preview: ${file})`);
    return { messageId: info.messageId, preview: file };
  } catch (err) {
    logger.warn(`[email:dev] preview write failed: ${err.message}`);
    return { messageId: info.messageId, preview: null };
  }
};

/**
 * Record what happened to one email.
 *
 * With plain SMTP there are no delivery webhooks, so this realistically records
 * 'sent' or 'failed' and nothing further. That is the honest ceiling: 'sent'
 * means the SMTP server accepted it, not that anybody received it.
 *
 * @param {Object} db
 * @param {Object} event
 * @param {string} event.companyId
 * @param {string|null} [event.invoiceId=null]
 * @param {string} event.customerId
 * @param {string} event.type
 * @param {string} event.recipient
 * @param {string|null} [event.subject=null]
 * @param {string} event.providerStatus
 * @param {string|null} [event.providerMsgId=null]
 * @param {string|null} [event.error=null]
 * @returns {Promise<string>} the new emailEventId.
 */
export const recordEmailEvent = async (
  db,
  {
    companyId,
    invoiceId = null,
    customerId,
    type,
    recipient,
    subject = null,
    providerStatus,
    providerMsgId = null,
    error = null,
  }
) => {
  const [uuidRow] = await db.query(`SELECT UUID() AS id`);
  const emailEventId = uuidRow.id;
  const now = getCurrentTimestampLocal();

  await db.query(
    `INSERT INTO email_events
       (emailEventId, companyId, invoiceId, customerId, type, recipient, subject,
        providerMsgId, providerStatus, error, dateCreated, dateUpdated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      emailEventId,
      companyId,
      invoiceId,
      customerId,
      type,
      recipient,
      subject,
      providerMsgId,
      providerStatus,
      // Truncated: a provider can return a wall of text, and the useful part is
      // always at the front.
      error ? String(error).slice(0, 2000) : null,
      now,
      now,
    ]
  );

  return emailEventId;
};

export default { sendEmail, isEmailConfigured, recordEmailEvent };
