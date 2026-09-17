import moment from "moment-timezone";

import { branchScope } from "../../utils/branchScope.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";
import {
  findLatestStatement,
  loadReconciliation,
} from "../payments/gcash-statement/statement.service.js";

/**
 * The three reports an ISP actually needs, as SQL and nothing else.
 *
 * Kept out of the controller so the same query answers both the on-screen
 * table and the CSV download. A report whose export disagrees with the page it
 * was exported from is worse than no export — somebody reconciles against it.
 *
 * ── Money is read, never computed, here ─────────────────────────────────────
 *
 * Every figure is a SUM over DECIMAL columns done by MySQL. The driver hands
 * those back as JavaScript numbers (`decimalNumbers: true`), which is safe to
 * display and never safe to do arithmetic on — so nothing in this file adds
 * two amounts together. Where a derived figure is needed it is derived in SQL.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/**
 * The `WHERE` fragment and parameters for a tenant-scoped report.
 *
 * @param {Object} user `req.user`.
 * @param {string} alias table alias carrying `branchId`.
 * @param {string[]|null} branchIds already-resolved scope.
 * @returns {{clause: string, params: Array}}
 */
const tenantFilter = (user, alias, branchIds) => {
  const scope = branchScope(`${alias}.branchId`, branchIds);
  return {
    clause: `${alias}.companyId = ?${scope.clause}`,
    params: [user.companyId, ...scope.params],
  };
};

/**
 * Aging — who owes what, and for how long.
 *
 * ── Why the buckets are what they are ───────────────────────────────────────
 *
 * 1–30 / 31–60 / 61–90 / 90+ is the convention every accountant already reads,
 * so the report needs no explaining. `Current` is separated from `1–30`
 * deliberately: an invoice issued on the 15th and not yet due on the 2nd is not
 * a debt anybody is late on, and folding it into the first overdue bucket makes
 * a healthy month look alarming.
 *
 * Buckets are computed from the DUE date, not the statement date — being late
 * is measured from when payment was owed.
 *
 * @param {Object} db
 * @param {Object} args
 * @param {Object} args.user
 * @param {string[]|null} args.branchIds
 * @param {Date|string} [args.asOf=new Date()]
 * @returns {Promise<{asOf: string, rows: Array, totals: Object}>}
 */
export const agingReport = async (db, { user, branchIds, asOf = new Date() }) => {
  const today = moment.tz(asOf, TZ).format("YYYY-MM-DD");
  const scope = tenantFilter(user, "i", branchIds);

  if (Array.isArray(branchIds) && branchIds.length === 0) {
    return { asOf: today, rows: [], totals: emptyAging() };
  }

  const rows = await db.query(
    `SELECT c.customerId,
            c.accountNo,
            c.name              AS customerName,
            c.phone             AS customerPhone,
            c.email             AS customerEmail,
            b.name              AS branchName,
            COUNT(i.invoiceId)  AS unpaidCount,
            MIN(i.dueDate)      AS oldestDueDate,
            DATEDIFF(?, MIN(i.dueDate)) AS daysPastDue,
            SUM(i.total)        AS totalOwed,
            SUM(CASE WHEN i.dueDate >= ? THEN i.total ELSE 0 END)                       AS current,
            SUM(CASE WHEN DATEDIFF(?, i.dueDate) BETWEEN 1  AND 30 THEN i.total ELSE 0 END) AS days1to30,
            SUM(CASE WHEN DATEDIFF(?, i.dueDate) BETWEEN 31 AND 60 THEN i.total ELSE 0 END) AS days31to60,
            SUM(CASE WHEN DATEDIFF(?, i.dueDate) BETWEEN 61 AND 90 THEN i.total ELSE 0 END) AS days61to90,
            SUM(CASE WHEN DATEDIFF(?, i.dueDate) > 90 THEN i.total ELSE 0 END)              AS days90plus
       FROM invoices i
       JOIN customers c ON c.customerId = i.customerId
       LEFT JOIN branches b ON b.branchId = i.branchId
      WHERE ${scope.clause}
        AND i.status IN ('issued', 'overdue')
      GROUP BY c.customerId, c.accountNo, c.name, c.phone, c.email, b.name
      ORDER BY MIN(i.dueDate) ASC`,
    [today, today, today, today, today, today, ...scope.params]
  );

  // Totals in SQL rather than by summing the rows in JavaScript — floats and
  // money do not mix, and this is the number somebody reconciles against.
  const [totals] = await db.query(
    `SELECT
       COALESCE(SUM(i.total), 0) AS totalOwed,
       COALESCE(SUM(CASE WHEN i.dueDate >= ? THEN i.total ELSE 0 END), 0)                       AS current,
       COALESCE(SUM(CASE WHEN DATEDIFF(?, i.dueDate) BETWEEN 1  AND 30 THEN i.total ELSE 0 END), 0) AS days1to30,
       COALESCE(SUM(CASE WHEN DATEDIFF(?, i.dueDate) BETWEEN 31 AND 60 THEN i.total ELSE 0 END), 0) AS days31to60,
       COALESCE(SUM(CASE WHEN DATEDIFF(?, i.dueDate) BETWEEN 61 AND 90 THEN i.total ELSE 0 END), 0) AS days61to90,
       COALESCE(SUM(CASE WHEN DATEDIFF(?, i.dueDate) > 90 THEN i.total ELSE 0 END), 0)              AS days90plus,
       COUNT(DISTINCT i.customerId) AS customers
     FROM invoices i
    WHERE ${scope.clause}
      AND i.status IN ('issued', 'overdue')`,
    [today, today, today, today, today, ...scope.params]
  );

  return { asOf: today, rows, totals };
};

const emptyAging = () => ({
  totalOwed: 0,
  current: 0,
  days1to30: 0,
  days31to60: 0,
  days61to90: 0,
  days90plus: 0,
  customers: 0,
});

/**
 * Collections — money actually received in a period.
 *
 * Reads `payments`, not invoices: this answers "what came in", which is the
 * question a cash reconciliation asks, and it is a different number from "what
 * was billed". An invoice raised in August and paid in September is September
 * collections.
 *
 * @param {Object} db
 * @param {Object} args
 * @param {Object} args.user
 * @param {string[]|null} args.branchIds
 * @param {string} args.from 'YYYY-MM-DD'
 * @param {string} args.to 'YYYY-MM-DD'
 * @returns {Promise<{from: string, to: string, rows: Array, byChannel: Array, totals: Object}>}
 */
export const collectionsReport = async (db, { user, branchIds, from, to }) => {
  const scope = tenantFilter(user, "p", branchIds);

  if (Array.isArray(branchIds) && branchIds.length === 0) {
    return { from, to, rows: [], byChannel: [], totals: { collected: 0, payments: 0 } };
  }

  // Inclusive of the whole end day. A date filter that silently stops at
  // midnight is a report that undercounts the day it was run.
  const range = [`${from} 00:00:00`, `${to} 23:59:59`];

  const [rows, byChannel, totalsRows] = await Promise.all([
    db.query(
      `SELECT p.paymentId, p.paidAt, p.amount, p.channel, p.provider, p.notes,
              i.invoiceNo, i.billingPeriodStart,
              c.accountNo, c.name AS customerName,
              b.name AS branchName,
              CONCAT(u.firstName, ' ', u.lastName) AS recordedByName
         FROM payments p
         LEFT JOIN invoices  i ON i.invoiceId = p.invoiceId
         LEFT JOIN customers c ON c.customerId = p.customerId
         LEFT JOIN branches  b ON b.branchId = p.branchId
         LEFT JOIN users     u ON u.accountId = p.recordedBy
        WHERE ${scope.clause} AND p.paidAt BETWEEN ? AND ?
        ORDER BY p.paidAt DESC`,
      [...scope.params, ...range]
    ),
    // How the money arrived. This is what decides whether a gateway's fees are
    // worth the volume going through it.
    db.query(
      `SELECT p.channel,
              COUNT(*)            AS payments,
              COALESCE(SUM(p.amount), 0) AS collected
         FROM payments p
        WHERE ${scope.clause} AND p.paidAt BETWEEN ? AND ?
        GROUP BY p.channel
        ORDER BY collected DESC`,
      [...scope.params, ...range]
    ),
    db.query(
      `SELECT COUNT(*) AS payments, COALESCE(SUM(p.amount), 0) AS collected
         FROM payments p
        WHERE ${scope.clause} AND p.paidAt BETWEEN ? AND ?`,
      [...scope.params, ...range]
    ),
  ]);

  return { from, to, rows, byChannel, totals: totalsRows[0] ?? { collected: 0, payments: 0 } };
};

/**
 * Subscribers — the roster, with what each one is on and what they owe.
 *
 * One row per subscription rather than per customer, because a customer with
 * two lines has two of everything that matters here: two plans, two modems,
 * two service states.
 *
 * @param {Object} db
 * @param {Object} args
 * @returns {Promise<{rows: Array, totals: Object}>}
 */
export const subscriberReport = async (db, { user, branchIds, status = null }) => {
  const scope = tenantFilter(user, "s", branchIds);

  if (Array.isArray(branchIds) && branchIds.length === 0) {
    return { rows: [], totals: { subscriptions: 0, monthlyRecurring: 0 } };
  }

  const params = [...scope.params];
  let statusFilter = "";
  if (status) {
    statusFilter = " AND s.status = ?";
    params.push(status);
  }

  const rows = await db.query(
    `SELECT s.subscriptionId, s.status AS serviceStatus, s.activatedAt,
            c.accountNo, c.name AS customerName, c.email AS customerEmail,
            c.phone AS customerPhone, c.address,
            p.name AS planName, p.monthlyPrice, p.downMbps, p.upMbps,
            o.mac AS onuMac, o.provisioningState,
            n.label AS napLabel, s.onuId,
            b.name AS branchName,
            COALESCE(owed.amountOwed, 0) AS amountOwed,
            COALESCE(owed.unpaidCount, 0) AS unpaidCount
       FROM subscriptions s
       JOIN customers c ON c.customerId = s.customerId
       JOIN plans p ON p.planId = s.planId
       LEFT JOIN onus o ON o.onuId = s.onuId
       LEFT JOIN naps n ON n.napId = o.napId
       LEFT JOIN branches b ON b.branchId = s.branchId
       LEFT JOIN (
         SELECT subscriptionId,
                SUM(total) AS amountOwed,
                COUNT(*)   AS unpaidCount
           FROM invoices
          WHERE status IN ('issued', 'overdue')
          GROUP BY subscriptionId
       ) owed ON owed.subscriptionId = s.subscriptionId
      WHERE ${scope.clause} AND s.recordStatus != 'Deleted'${statusFilter}
      ORDER BY c.name ASC`,
    params
  );

  // Monthly recurring revenue counts ACTIVE subscriptions only. A suspended
  // line bills nothing (see lib/billing/billing.dates.js), so counting it would
  // overstate the number the business plans against.
  const [totals] = await db.query(
    `SELECT COUNT(*) AS subscriptions,
            COALESCE(SUM(CASE WHEN s.status = 'active' THEN p.monthlyPrice ELSE 0 END), 0)
              AS monthlyRecurring
       FROM subscriptions s
       JOIN plans p ON p.planId = s.planId
      WHERE ${scope.clause} AND s.recordStatus != 'Deleted'${statusFilter}`,
    params
  );

  return { rows, totals };
};

/**
 * Everything the operations dashboard shows, in one round trip.
 *
 * ── Grouped by the question it answers, not by table ────────────────────────
 *
 * `money` is this calendar month. `service` is right now. `attention` is the
 * list of things that will not fix themselves — and it is the reason this
 * screen is worth opening in the morning.
 *
 * @param {Object} db
 * @param {Object} args
 * @returns {Promise<Object>}
 */
export const operationsSummary = async (db, { user, branchIds }) => {
  const now = moment().tz(TZ);
  const monthStart = now.clone().startOf("month").format("YYYY-MM-DD");
  const monthEnd = now.clone().endOf("month").format("YYYY-MM-DD");
  const today = now.format("YYYY-MM-DD");
  const nowStamp = getCurrentTimestampLocal();

  if (Array.isArray(branchIds) && branchIds.length === 0) {
    return emptySummary(monthStart, monthEnd);
  }

  const inv = tenantFilter(user, "i", branchIds);
  const pay = tenantFilter(user, "p", branchIds);
  const sub = tenantFilter(user, "s", branchIds);
  const onu = tenantFilter(user, "o", branchIds);

  // Jobs carry no branch when they are company-wide, so the scope has to
  // tolerate NULL or the queue looks empty to a branch user.
  const jobScope = branchScope("j.branchId", branchIds);
  const jobClause = jobScope.clause ? ` AND (j.branchId IS NULL${jobScope.clause})` : "";

  const [money, service, network, queue, dunning, series] = await Promise.all([
    db.query(
      `SELECT
         -- Excluding voids matters: a voided invoice is a bill that was
         -- cancelled, and counting it here made this figure disagree with the
         -- billed-versus-collected chart directly beneath it, which excludes
         -- them. Two numbers on one screen that do not reconcile is worse than
         -- either being slightly wrong.
         COALESCE(SUM(CASE WHEN i.billingPeriodStart = ? AND i.status != 'void'
                           THEN i.total ELSE 0 END), 0) AS billedThisMonth,
         COALESCE(SUM(CASE WHEN i.status IN ('issued','overdue') THEN i.total ELSE 0 END), 0) AS outstanding,
         COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.total ELSE 0 END), 0) AS overdue,
         COUNT(CASE WHEN i.status IN ('issued','overdue') THEN 1 END) AS openInvoices
       FROM invoices i WHERE ${inv.clause}`,
      [monthStart, ...inv.params]
    ),
    db.query(
      `SELECT
         COUNT(CASE WHEN s.status = 'active' THEN 1 END)        AS active,
         COUNT(CASE WHEN s.status = 'suspended' THEN 1 END)     AS suspended,
         COUNT(CASE WHEN s.status = 'pending' THEN 1 END)       AS pending,
         -- Revoked and awaiting a technician. Counted separately from suspended
         -- because these are not customers any more, they are field work.
         COUNT(CASE WHEN s.status = 'for_recovery' THEN 1 END)  AS forRecovery,
         COALESCE(SUM(CASE WHEN s.status = 'active' THEN p.monthlyPrice ELSE 0 END), 0) AS monthlyRecurring
       FROM subscriptions s
       JOIN plans p ON p.planId = s.planId
      WHERE ${sub.clause} AND s.recordStatus != 'Deleted'`,
      sub.params
    ),
    db.query(
      `SELECT
         COUNT(CASE WHEN o.provisioningState = 'active' THEN 1 END)        AS onusActive,
         COUNT(CASE WHEN o.provisioningState = 'suspended' THEN 1 END)     AS onusSuspended,
         COUNT(CASE WHEN o.provisioningState = 'offline' THEN 1 END)       AS onusOffline,
         COUNT(CASE WHEN o.provisioningState = 'unprovisioned' THEN 1 END) AS onusUnprovisioned
       FROM onus o WHERE ${onu.clause} AND o.recordStatus != 'Deleted'`,
      onu.params
    ),
    // The things that will not fix themselves.
    db.query(
      `SELECT
         COUNT(CASE WHEN j.status = 'dead' THEN 1 END)                        AS deadLetters,
         COUNT(CASE WHEN j.status = 'queued' THEN 1 END)                      AS queued,
         COUNT(CASE WHEN j.status = 'processing' THEN 1 END)                  AS processing,
         COUNT(CASE WHEN j.status = 'failed' THEN 1 END)                      AS failed
       FROM jobs j WHERE j.companyId = ?${jobClause}`,
      [user.companyId, ...jobScope.params]
    ),
    db.query(
      `SELECT COUNT(DISTINCT s.subscriptionId) AS atRisk
         FROM subscriptions s
         JOIN invoices i ON i.subscriptionId = s.subscriptionId
        WHERE ${sub.clause}
          AND s.status = 'active' AND s.recordStatus != 'Deleted'
          AND i.status IN ('issued','overdue') AND i.dueDate < ?`,
      [...sub.params, today]
    ),
    // Six months of billed-versus-collected. Billed is dated by the period it
    // covers; collected by when the money arrived — which is why the two lines
    // legitimately diverge and why showing both is the point.
    db.query(
      `SELECT months.period,
              COALESCE(billed.amount, 0)    AS billed,
              COALESCE(collected.amount, 0) AS collected
         FROM (
           SELECT DATE_FORMAT(DATE_SUB(?, INTERVAL n MONTH), '%Y-%m-01') AS period
             FROM (SELECT 0 AS n UNION SELECT 1 UNION SELECT 2
                   UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) AS offsets
         ) AS months
         LEFT JOIN (
           SELECT i.billingPeriodStart AS period, SUM(i.total) AS amount
             FROM invoices i
            WHERE ${inv.clause} AND i.status != 'void'
            GROUP BY i.billingPeriodStart
         ) AS billed ON billed.period = months.period
         LEFT JOIN (
           SELECT DATE_FORMAT(p.paidAt, '%Y-%m-01') AS period, SUM(p.amount) AS amount
             FROM payments p
            WHERE ${pay.clause}
            GROUP BY DATE_FORMAT(p.paidAt, '%Y-%m-01')
         ) AS collected ON collected.period = months.period
        ORDER BY months.period ASC`,
      [monthStart, ...inv.params, ...pay.params]
    ),
  ]);

  const [unappliedAdjustments] = await db.query(
    `SELECT COUNT(*) AS n FROM pending_charges pc
      WHERE pc.companyId = ?${branchScope("pc.branchId", branchIds).clause}
        AND pc.appliedInvoiceId IS NULL AND pc.status = 'Active'`,
    [user.companyId, ...branchScope("pc.branchId", branchIds).params]
  );

  const [liveExemptions] = await db.query(
    `SELECT COUNT(*) AS n FROM dunning_exemptions de
      WHERE de.companyId = ?${branchScope("de.branchId", branchIds).clause}
        AND de.status = 'Active' AND de.expiresAt > ?`,
    [user.companyId, ...branchScope("de.branchId", branchIds).params, nowStamp]
  );

  // The latest GCash check, recomputed — so the alert clears the moment a
  // reference is fixed or a payment recorded, not at the next upload.
  const latestStatement = await findLatestStatement(db, { companyId: user.companyId, branchIds });
  const gcash = latestStatement
    ? (await loadReconciliation(db, { companyId: user.companyId, branchIds, statement: latestStatement }))
        .summary
    : null;

  return {
    period: { monthStart, monthEnd },
    money: money[0],
    service: service[0],
    network: network[0],
    attention: {
      ...queue[0],
      atRisk: Number(dunning[0]?.atRisk ?? 0),
      unappliedAdjustments: Number(unappliedAdjustments?.n ?? 0),
      liveExemptions: Number(liveExemptions?.n ?? 0),
      gcash: gcash && {
        statementId: latestStatement.statementId,
        periodEnd: latestStatement.periodEnd,
        possibleTypos: gcash.possibleTypos,
        inFileNotRecorded: gcash.inFileNotRecorded,
        recordedNotInFile: gcash.recordedNotInFile,
        amountDiffers: gcash.amountDiffers,
      },
    },
    series,
  };
};

const emptySummary = (monthStart, monthEnd) => ({
  period: { monthStart, monthEnd },
  money: { billedThisMonth: 0, outstanding: 0, overdue: 0, openInvoices: 0 },
  service: { active: 0, suspended: 0, pending: 0, monthlyRecurring: 0 },
  network: { onusActive: 0, onusSuspended: 0, onusOffline: 0, onusUnprovisioned: 0 },
  attention: {
    deadLetters: 0,
    queued: 0,
    processing: 0,
    failed: 0,
    atRisk: 0,
    unappliedAdjustments: 0,
    liveExemptions: 0,
    gcash: null,
  },
  series: [],
});

export default {
  agingReport,
  collectionsReport,
  subscriberReport,
  operationsSummary,
};
