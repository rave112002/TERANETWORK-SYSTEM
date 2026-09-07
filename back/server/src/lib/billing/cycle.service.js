import crypto from "node:crypto";

import { computeBilledPeriod, serviceDaysInPeriod } from "./billing.dates.js";
import { buildInvoiceComputation } from "./invoice.calc.js";
import { formatReference, nextSequence } from "../counters/counters.js";
import { enqueue } from "../jobs/jobs.queue.js";
import { getVatRate } from "../settings/settings.service.js";
import { writeAudit, systemAuditContext } from "../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";

/**
 * The billing cycle engine.
 *
 * `generateInvoiceForSubscription()` creates one issued invoice for the month
 * `runDate` falls in. `runMonthlyCycle()` does that for every active
 * subscription — this is what the scheduler calls on the 15th.
 *
 * ── Everything here is idempotent, deliberately ─────────────────────────────
 *
 * A billing run gets repeated. A retry fires, an operator re-runs it after a
 * partial failure, two workers both think they are alone. The consequence of
 * getting that wrong is a customer billed twice, so the safety is in the
 * database rather than in a pre-check:
 *
 *   - `invoices` UNIQUE(subscriptionId, billingPeriodStart) — the second run
 *     for a period gets ER_DUP_ENTRY, which is caught and reported as skipped.
 *   - `pending_charges.appliedInvoiceId IS NULL`, read FOR UPDATE inside the
 *     same transaction that stamps it — a carried charge lands on exactly one
 *     invoice.
 *   - the "invoice issued" email is enqueued in that same transaction, so the
 *     job exists if and only if the invoice does.
 *
 * The pre-checks that exist are there to skip cheaply, not to be relied on.
 */

/**
 * Allocate the next sequential invoice number for a year, on the caller's
 * transaction.
 *
 * Per year rather than continuous, because that is how invoice numbers are read
 * by everyone who handles them. `nextSequence` serialises the allocation, so
 * two invoices can never take the same number.
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} companyId
 * @param {number} year
 * @returns {Promise<string>} e.g. "INV-2026-000123"
 */
export const allocateInvoiceNo = async (conn, companyId, year) => {
  const value = await nextSequence(conn, `invoiceNo:${companyId}:${year}`);
  return formatReference(`INV-${year}`, value);
};

/**
 * Generate one invoice for a subscription, for the month `runDate` falls in.
 *
 * @param {Object} db the `Database` wrapper (`req.db`).
 * @param {string} subscriptionId
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()] which month to bill.
 * @param {Object} [opts.context] audit context; defaults to the cycle system actor.
 * @returns {Promise<{status: 'created'|'skipped', reason?: string, invoiceId?: string, invoiceNo?: string, total?: string}>}
 */
export const generateInvoiceForSubscription = async (
  db,
  subscriptionId,
  { runDate = new Date(), context = null } = {}
) => {
  const period = computeBilledPeriod(runDate);

  const rows = await db.query(
    `SELECT s.subscriptionId, s.companyId, s.branchId, s.customerId, s.planId,
            s.status, s.activatedAt,
            p.name AS planName, p.monthlyPrice, p.installFee
       FROM subscriptions s
       JOIN plans p ON p.planId = s.planId
      WHERE s.subscriptionId = ? AND s.recordStatus != 'Deleted'
      LIMIT 1`,
    [subscriptionId]
  );

  const sub = rows[0];
  if (!sub) return { status: "skipped", reason: "subscription_not_found" };

  // A suspended subscription is skipped and never billed. That is the whole
  // point of issuing on the 15th — see billing.dates.js.
  if (sub.status !== "active") return { status: "skipped", reason: "not_active" };

  const existing = await db.query(
    `SELECT invoiceId FROM invoices
      WHERE subscriptionId = ? AND billingPeriodStart = ? LIMIT 1`,
    [subscriptionId, period.periodStart]
  );
  if (existing.length > 0) return { status: "skipped", reason: "already_billed" };

  // Proration is driven ONLY by when the subscription was first activated. A
  // suspension does not reduce the bill; billing.dates.js explains why, and why
  // that is not a bug to fix here.
  const serviceDays = serviceDaysInPeriod(
    sub.activatedAt,
    period.periodStart,
    period.periodEnd,
    period.daysInMonth
  );
  if (serviceDays <= 0) return { status: "skipped", reason: "activated_after_period" };

  const priorCount = await db.query(
    `SELECT COUNT(*) AS n FROM invoices WHERE subscriptionId = ?`,
    [subscriptionId]
  );
  const isFirstInvoice = Number(priorCount[0].n) === 0;

  const vatRate = await getVatRate(db, sub.companyId);

  const auditContext =
    context ?? systemAuditContext("billing_cycle", { companyId: sub.companyId, branchId: sub.branchId });

  let conn;
  try {
    conn = await db.beginTransaction();

    // Carried-over one-off charges. Locked, so two concurrent runs cannot both
    // claim the same charge; `appliedInvoiceId IS NULL` is the guard that makes
    // the stamp below final.
    const [pending] = await conn.execute(
      `SELECT pendingChargeId, kind, description, amount
         FROM pending_charges
        WHERE subscriptionId = ? AND appliedInvoiceId IS NULL AND status = 'Active'
        ORDER BY id
        FOR UPDATE`,
      [subscriptionId]
    );

    const comp = buildInvoiceComputation({
      plan: {
        name: sub.planName,
        monthlyPrice: sub.monthlyPrice,
        installFee: sub.installFee,
      },
      daysInMonth: period.daysInMonth,
      serviceDays,
      includeInstallFee: isFirstInvoice,
      vatRate,
      extraLines: pending.map((p) => ({
        kind: p.kind,
        description: p.description,
        amount: p.amount,
      })),
    });

    const [uuidRow] = await conn.execute(`SELECT UUID() AS id`);
    const invoiceId = uuidRow[0].id;
    const invoiceNo = await allocateInvoiceNo(conn, sub.companyId, period.year);
    // 16 bytes of randomness. This is the only thing standing between the
    // public payment page and someone else's invoice, so it is not derived
    // from the invoice number or anything else guessable.
    const publicToken = crypto.randomBytes(16).toString("hex");
    const now = getCurrentTimestampLocal();

    await conn.execute(
      `INSERT INTO invoices
         (invoiceId, companyId, branchId, subscriptionId, customerId, invoiceNo,
          billingPeriodStart, billingPeriodEnd, statementDate, dueDate,
          subtotal, fees, tax, total, status, publicToken, issuedAt,
          dateCreated, dateUpdated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?)`,
      [
        invoiceId,
        sub.companyId,
        sub.branchId,
        subscriptionId,
        sub.customerId,
        invoiceNo,
        period.periodStart,
        period.periodEnd,
        period.statementDate,
        period.dueDate,
        comp.subtotal,
        comp.fees,
        comp.tax,
        comp.total,
        publicToken,
        now,
        now,
        now,
      ]
    );

    let sortOrder = 0;
    for (const line of comp.lines) {
      const [lineUuid] = await conn.execute(`SELECT UUID() AS id`);
      await conn.execute(
        `INSERT INTO invoice_lines
           (invoiceLineId, invoiceId, kind, description, qty, unitPrice, amount, sortOrder, dateCreated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lineUuid[0].id,
          invoiceId,
          line.kind,
          line.description,
          line.qty,
          line.unitPrice,
          line.amount,
          sortOrder,
          now,
        ]
      );
      sortOrder += 1;
    }

    // Stamp the carried charges as billed, in the same transaction as the lines
    // they became. A charge is either on this invoice or still pending — never
    // both, and never neither.
    if (pending.length > 0) {
      await conn.execute(
        `UPDATE pending_charges
            SET appliedInvoiceId = ?, appliedAt = ?, dateUpdated = ?
          WHERE pendingChargeId IN (${pending.map(() => "?").join(",")})`,
        [invoiceId, now, now, ...pending.map((p) => p.pendingChargeId)]
      );
    }

    await writeAudit(conn, {
      context: auditContext,
      module: "billing",
      action: "invoice_generated",
      description: `Invoice ${invoiceNo} for ${period.periodStart}`,
      after: {
        invoiceId,
        invoiceNo,
        total: comp.total,
        periodStart: period.periodStart,
        serviceDays,
      },
    });

    // Queued in the same transaction, so the email job exists if and only if
    // the invoice does. The worker renders the PDF and sends it.
    await enqueue(conn, {
      companyId: sub.companyId,
      branchId: sub.branchId,
      type: "email",
      payload: { kind: "invoice_issued", invoiceId, customerId: sub.customerId },
      dedupeKey: `email:invoice_issued:${invoiceId}`,
    });

    await db.commit(conn);
    return { status: "created", invoiceId, invoiceNo, total: comp.total };
  } catch (err) {
    if (conn) await db.rollback(conn);
    // Lost the race on the period key: someone else billed it a moment ago.
    if (err?.code === "ER_DUP_ENTRY") {
      return { status: "skipped", reason: "already_billed" };
    }
    throw err;
  }
};

/**
 * Run the cycle for every active subscription for the month of `runDate`.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate=new Date()]
 * @param {string|null} [opts.companyId=null] limit to one company.
 * @param {string[]|null} [opts.branchIds=null] limit to these branches; null means all.
 * @param {Object} [opts.context] audit context.
 * @returns {Promise<{period: Object, created: number, skipped: number, failed: number, results: Array}>}
 */
export const runMonthlyCycle = async (
  db,
  { runDate = new Date(), companyId = null, branchIds = null, context = null } = {}
) => {
  const period = computeBilledPeriod(runDate);

  const where = [`status = 'active'`, `recordStatus != 'Deleted'`];
  const params = [];
  if (companyId) {
    where.push(`companyId = ?`);
    params.push(companyId);
  }
  if (Array.isArray(branchIds)) {
    // An empty list means "no branches in scope", which must select nothing
    // rather than everything.
    if (branchIds.length === 0) return { period, created: 0, skipped: 0, failed: 0, results: [] };
    where.push(`branchId IN (${branchIds.map(() => "?").join(",")})`);
    params.push(...branchIds);
  }

  const subs = await db.query(
    `SELECT subscriptionId FROM subscriptions WHERE ${where.join(" AND ")} ORDER BY id`,
    params
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  for (const s of subs) {
    // Each subscription is its own transaction. One customer's bad data must
    // not abort the other nine hundred invoices.
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await generateInvoiceForSubscription(db, s.subscriptionId, { runDate, context });
      results.push({ subscriptionId: s.subscriptionId, ...res });
      if (res.status === "created") created += 1;
      else skipped += 1;
    } catch (err) {
      failed += 1;
      results.push({
        subscriptionId: s.subscriptionId,
        status: "failed",
        reason: err?.message ?? "unknown_error",
      });
    }
  }

  return { period, created, skipped, failed, results };
};

export default { allocateInvoiceNo, generateInvoiceForSubscription, runMonthlyCycle };
