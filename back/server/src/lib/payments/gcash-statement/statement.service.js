import { branchScope } from "../../../utils/branchScope.js";
import { STATEMENT_CHANNELS } from "../reference.js";
import { reconcileStatement } from "./reconcile.js";

/**
 * Loads what one statement check compares, and compares it.
 *
 * ── The window ──────────────────────────────────────────────────────────────
 *
 * A statement covers dates. Payments recorded in those dates must appear in it,
 * and lines dated in it must have been recorded — that is the check. Two
 * cross-lookups stop the edges producing false alarms:
 *
 *   - a payment recorded on 1 Sep for money that arrived 31 Aug still matches
 *     its August line, because lines are also looked up by the references of
 *     in-window payments, whatever their date;
 *   - the same the other way round for a line whose payment was recorded late.
 *
 * ── Which payments ──────────────────────────────────────────────────────────
 *
 * Manual entries (`provider IS NULL`) on the channels that land in the GCash
 * account. Cash never reaches the statement; parked-gateway payments never
 * went through this account.
 */

const PAYMENT_SELECT = `SELECT p.paymentId, p.invoiceId, p.customerId, p.amount, p.channel,
    p.providerPaymentId AS referenceNo, p.paidAt, p.notes,
    i.invoiceNo, c.name AS customerName, c.accountNo,
    CONCAT(u.firstName, ' ', u.lastName) AS recordedByName
  FROM payments p
  LEFT JOIN invoices i ON i.invoiceId = p.invoiceId
  LEFT JOIN customers c ON c.customerId = p.customerId
  LEFT JOIN users u ON u.accountId = p.recordedBy`;

const TRANSACTION_SELECT = `SELECT transactionId, statementId, referenceNo, transactedAt, description,
    amount, reviewStatus, reviewedAt
  FROM gcash_statement_transactions`;

const placeholders = (values) => values.map(() => "?").join(", ");

/**
 * @param {Object} db `req.db`
 * @param {Object} args
 * @param {string} args.companyId
 * @param {string[]} args.branchIds
 * @param {{periodStart: string, periodEnd: string}} args.statement
 */
export const loadReconciliation = async (db, { companyId, branchIds, statement }) => {
  const from = `${String(statement.periodStart).slice(0, 10)} 00:00:00`;
  const to = `${String(statement.periodEnd).slice(0, 10)} 23:59:59`;

  const pScope = branchScope("p.branchId", branchIds);
  const tScope = branchScope("branchId", branchIds);
  const paymentWhere = `WHERE p.companyId = ?${pScope.clause}
      AND p.provider IS NULL AND p.providerPaymentId IS NOT NULL
      AND p.channel IN (${placeholders(STATEMENT_CHANNELS)})`;
  const paymentParams = [companyId, ...pScope.params, ...STATEMENT_CHANNELS];
  const transactionWhere = `WHERE companyId = ?${tScope.clause} AND status = 'Active'`;
  const transactionParams = [companyId, ...tScope.params];

  const [paymentsInWindow, transactionsInWindow] = await Promise.all([
    db.query(`${PAYMENT_SELECT} ${paymentWhere} AND p.paidAt BETWEEN ? AND ?`, [
      ...paymentParams,
      from,
      to,
    ]),
    db.query(`${TRANSACTION_SELECT} ${transactionWhere} AND transactedAt BETWEEN ? AND ?`, [
      ...transactionParams,
      from,
      to,
    ]),
  ]);

  const knownTransactions = new Set(transactionsInWindow.map((t) => t.referenceNo));
  const knownPayments = new Set(paymentsInWindow.map((p) => p.referenceNo));
  const paymentRefsToFind = [...knownPayments].filter((r) => !knownTransactions.has(r));
  const transactionRefsToFind = [...knownTransactions].filter((r) => !knownPayments.has(r));

  const [transactionsOutside, paymentsOutside] = await Promise.all([
    paymentRefsToFind.length
      ? db.query(
          `${TRANSACTION_SELECT} ${transactionWhere} AND referenceNo IN (${placeholders(paymentRefsToFind)})`,
          [...transactionParams, ...paymentRefsToFind]
        )
      : [],
    transactionRefsToFind.length
      ? db.query(
          `${PAYMENT_SELECT} ${paymentWhere} AND p.providerPaymentId IN (${placeholders(transactionRefsToFind)})`,
          [...paymentParams, ...transactionRefsToFind]
        )
      : [],
  ]);

  return reconcileStatement({
    payments: [...paymentsInWindow, ...paymentsOutside],
    transactions: [...transactionsInWindow, ...transactionsOutside],
  });
};

/** The most recent statement still on file, or undefined. */
export const findLatestStatement = async (db, { companyId, branchIds }) => {
  const scope = branchScope("branchId", branchIds);
  const [latest] = await db.query(
    `SELECT statementId, periodStart, periodEnd, dateCreated
       FROM gcash_statements
      WHERE companyId = ?${scope.clause} AND status = 'Active'
      ORDER BY periodEnd DESC, dateCreated DESC
      LIMIT 1`,
    [companyId, ...scope.params]
  );
  return latest;
};

export default { loadReconciliation, findLatestStatement };
