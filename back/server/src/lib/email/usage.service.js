import moment from "moment-timezone";

import { isEmailConfigured } from "./email.service.js";
import {
  DEFAULT_EMAIL_DAILY_LIMIT,
  emailUsageLevel,
} from "../../../../../shared/manage-contract/index.js";

/**
 * How much of the sending account's daily limit this branch has used.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Each branch sends through its own Gmail account with an App Password. A
 * regular Gmail account takes roughly 500 recipients per ROLLING 24 hours —
 * not per calendar day — and past that it refuses mail until older sends age
 * out. So the count here is "the last 24 hours", not "today".
 *
 * Every invoice notice is recorded in `email_events`, so that table is the
 * count. The only mail it misses is a staff password reset, which is a handful
 * a month and not worth a table of its own.
 *
 * Gmail refuses with "550 5.4.5 Daily user sending limit exceeded" (older
 * wording: "quota exceeded"). Those failures are counted separately: one of
 * them means the limit is really hit, whatever the count says — the account
 * may also be used by hand, which this system cannot see.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/** EMAIL_DAILY_LIMIT from the environment, or Gmail's regular-account limit. */
export const emailDailyLimit = () => {
  const n = Number.parseInt(process.env.EMAIL_DAILY_LIMIT ?? "", 10);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_EMAIL_DAILY_LIMIT;
};

/** The SQL test for "the mail server refused this because of the sending limit". */
const QUOTA_ERROR_SQL = `(error LIKE '%5.4.5%' OR error LIKE '%quota%' OR error LIKE '%sending limit%')`;

/**
 * The counts only — cheap enough for the dashboard and the health report.
 *
 * @param {Object} db
 * @param {string} companyId
 * @returns {Promise<import('../../../../../shared/manage-contract/index.js').EmailUsage>}
 */
export const getEmailUsageCounts = async (db, companyId) => {
  const since = moment().tz(TZ).subtract(24, "hours").format("YYYY-MM-DD HH:mm:ss");

  const [row] = await db.query(
    `SELECT
       COUNT(CASE WHEN providerStatus = 'sent' THEN 1 END)                         AS sent,
       COUNT(CASE WHEN providerStatus = 'failed' THEN 1 END)                       AS failed,
       COUNT(CASE WHEN providerStatus = 'failed' AND ${QUOTA_ERROR_SQL} THEN 1 END) AS quotaRefused
     FROM email_events
     WHERE companyId = ? AND dateCreated >= ?`,
    [companyId, since]
  );

  return {
    sentLast24h: Number(row?.sent ?? 0),
    failedLast24h: Number(row?.failed ?? 0),
    quotaRefusedLast24h: Number(row?.quotaRefused ?? 0),
    limit: emailDailyLimit(),
    configured: isEmailConfigured(),
  };
};

/**
 * The full picture for Admin → System: the counts, how many invoice emails the
 * next statement day will send, and the latest failures with their reasons.
 *
 * @param {Object} db
 * @param {string} companyId
 */
export const getEmailUsage = async (db, companyId) => {
  const since = moment().tz(TZ).subtract(24, "hours").format("YYYY-MM-DD HH:mm:ss");

  const [counts, [billable], recentFailures] = await Promise.all([
    getEmailUsageCounts(db, companyId),
    // What the statement-day run bills (cycle.service.js: every active
    // subscription), narrowed to customers who have an address to send to.
    db.query(
      `SELECT COUNT(*) AS n
         FROM subscriptions s
         JOIN customers c ON c.customerId = s.customerId
        WHERE s.companyId = ? AND s.status = 'active' AND s.recordStatus != 'Deleted'
          AND c.status != 'Deleted' AND c.email IS NOT NULL AND c.email != ''`,
      [companyId]
    ),
    db.query(
      `SELECT e.emailEventId, e.type, e.recipient, e.error, e.dateCreated, i.invoiceNo
         FROM email_events e
         LEFT JOIN invoices i ON i.invoiceId = e.invoiceId
        WHERE e.companyId = ? AND e.providerStatus = 'failed' AND e.dateCreated >= ?
        ORDER BY e.dateCreated DESC
        LIMIT 5`,
      [companyId, since]
    ),
  ]);

  return {
    ...counts,
    level: emailUsageLevel(counts),
    statementDayEstimate: Number(billable?.n ?? 0),
    recentFailures,
  };
};

export default { emailDailyLimit, getEmailUsageCounts, getEmailUsage };
