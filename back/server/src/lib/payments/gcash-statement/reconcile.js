import { amountsEqual } from "../../money/money.js";

/**
 * Compares what staff recorded with what the GCash statement says arrived.
 *
 * ── The results ─────────────────────────────────────────────────────────────
 *
 *   matched            reference in both, same amount          confirmed
 *   amountDiffers      reference in both, different amount     a typo, or a fee taken off
 *   recordedNotInFile  recorded, reference not in the file     mistyped reference or a fake screenshot
 *   inFileNotRecorded  in the file, nobody recorded it         a paying customer may still be cut off
 *   notCustomer        staff marked the line as not a customer payment (personal account)
 *
 * plus `possibleTypos`: a `recordedNotInFile` payment and an `inFileNotRecorded`
 * line whose references differ by one or two keystrokes. References are typed
 * by hand from a screenshot, so this is the most likely explanation for both
 * rows at once — and fixing it clears two problems in one go.
 *
 * ── It only reports ─────────────────────────────────────────────────────────
 *
 * Nothing here settles, unsettles or edits a payment. A person decides.
 *
 * Pure: the controller loads the rows, this sorts them.
 */

/**
 * Edit distance counting a swap of two neighbouring characters as one edit —
 * the typo people actually make when copying digits ("1243" for "1234").
 * Stops early once the distance is past `limit`.
 */
export const referenceDistance = (a, b, limit = 3) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, (_, i) => {
    const row = new Array(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;

  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > limit) return limit + 1;
  }
  return d[rows - 1][cols - 1];
};

/**
 * How far apart two references may be and still be flagged. Short references
 * get less room, or unrelated ones start to look alike.
 */
export const typoThreshold = (reference) => (reference.length >= 10 ? 2 : 1);

/**
 * @param {Object} args
 * @param {Array<{paymentId: string, referenceNo: string, amount: string|number}>} args.payments
 *   manual payments on the channels that land in the GCash account.
 * @param {Array<{transactionId: string, referenceNo: string, amount: string|number,
 *   reviewStatus: 'open'|'not_customer'}>} args.transactions incoming statement lines.
 */
export const reconcileStatement = ({ payments, transactions }) => {
  const byReference = new Map(transactions.map((t) => [t.referenceNo, t]));
  const paidReferences = new Set(payments.map((p) => p.referenceNo));

  const matched = [];
  const amountDiffers = [];
  const recordedNotInFile = [];

  for (const payment of payments) {
    const transaction = byReference.get(payment.referenceNo);
    if (!transaction) recordedNotInFile.push({ payment });
    else if (amountsEqual(payment.amount, transaction.amount))
      matched.push({ payment, transaction });
    else amountDiffers.push({ payment, transaction });
  }

  const unrecorded = transactions.filter((t) => !paidReferences.has(t.referenceNo));
  const inFileNotRecorded = unrecorded
    .filter((t) => t.reviewStatus !== "not_customer")
    .map((transaction) => ({ transaction }));
  const notCustomer = unrecorded
    .filter((t) => t.reviewStatus === "not_customer")
    .map((transaction) => ({ transaction }));

  const possibleTypos = [];
  for (const { payment } of recordedNotInFile) {
    for (const { transaction } of inFileNotRecorded) {
      const distance = referenceDistance(payment.referenceNo, transaction.referenceNo);
      const threshold = Math.min(
        typoThreshold(payment.referenceNo),
        typoThreshold(transaction.referenceNo)
      );
      if (distance <= threshold) {
        possibleTypos.push({
          payment,
          transaction,
          distance,
          sameAmount: amountsEqual(payment.amount, transaction.amount),
        });
      }
    }
  }
  // Closest first; among equals, the one whose amount also agrees.
  possibleTypos.sort(
    (a, b) => a.distance - b.distance || Number(b.sameAmount) - Number(a.sameAmount)
  );

  return {
    summary: {
      matched: matched.length,
      amountDiffers: amountDiffers.length,
      recordedNotInFile: recordedNotInFile.length,
      inFileNotRecorded: inFileNotRecorded.length,
      notCustomer: notCustomer.length,
      possibleTypos: possibleTypos.length,
    },
    matched,
    amountDiffers,
    recordedNotInFile,
    inFileNotRecorded,
    notCustomer,
    possibleTypos,
  };
};

export default { reconcileStatement, referenceDistance, typoThreshold };
