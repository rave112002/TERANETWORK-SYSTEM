import nodemailer from "nodemailer";

import { logger } from "../../../config/logger.js";

/**
 * Email transport — env-gated.
 *
 * If SMTP_HOST is configured, a real SMTP transport is used. Otherwise the
 * template still runs (no keys required): emails are logged to the console via
 * nodemailer's JSON transport, so you can see reset links etc. in development.
 *
 * Env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
 *   MAIL_FROM   e.g.  "Template <no-reply@template.test>"
 */

let transporter = null;
let isRealTransport = false;

const getTransporter = () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587/STARTTLS
      auth:
        process.env.SMTP_USER || process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    isRealTransport = true;
  } else {
    // Dev fallback: don't send anything, just serialize to JSON so it's logged.
    transporter = nodemailer.createTransport({ jsonTransport: true });
    isRealTransport = false;
  }

  return transporter;
};

const DEFAULT_FROM = process.env.MAIL_FROM || "Template <no-reply@template.test>";

/**
 * Send an email. Never throws to the caller by default — a failed email must
 * not break the request flow (e.g. forgot-password stays a 200). Pass
 * `{ throwOnError: true }` if a caller needs to know.
 *
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 * @param {boolean} [opts.throwOnError=false]
 * @returns {Promise<{ sent: boolean }>}
 */
export const sendMail = async ({ to, subject, html, text, throwOnError = false }) => {
  try {
    const info = await getTransporter().sendMail({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });

    if (isRealTransport) {
      logger.info("Email sent", { to, subject, messageId: info.messageId });
    } else {
      // Dev: surface the full message (incl. any links) in the logs
      logger.info("Email (dev console transport — not actually sent)", {
        to,
        subject,
        body: info.message,
      });
    }

    return { sent: true };
  } catch (error) {
    logger.error("Failed to send email", { to, subject, error: error.message });
    if (throwOnError) throw error;
    return { sent: false };
  }
};

export default { sendMail };
