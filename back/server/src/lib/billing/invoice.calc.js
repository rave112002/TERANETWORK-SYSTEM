import { money, sumAmounts, toAmount } from "../money/money.js";

/**
 * Pure invoice arithmetic. No database, no side effects.
 *
 * Given a plan and how many days of service to bill, it produces the invoice
 * lines and the subtotal/fees/tax/total. Being pure is what makes it testable,
 * which matters more here than anywhere else in the system: every branch of
 * this file is a number a customer is asked to pay.
 *
 * Every amount it returns is a 2dp STRING from money.js, not a float. Strings
 * go into DECIMAL columns unchanged and survive JSON without a rounding step,
 * so a total computed here is the same total the customer is charged and the
 * same total the payment is checked against.
 */

/**
 * Which line kinds are reported as "fees" rather than in the subtotal.
 *
 * Only the split on the invoice header — both are taxed, and both are in the
 * total. Nothing here is optional to pay.
 */
export const FEE_KINDS = new Set(["install_fee", "reconnection_fee"]);

/**
 * Build the lines and totals for one invoice.
 *
 * @param {Object} args
 * @param {{ name: string, monthlyPrice: number|string, installFee: number|string }} args.plan
 * @param {number} args.daysInMonth
 * @param {number} args.serviceDays  equal to daysInMonth for a full month; fewer prorates.
 * @param {boolean} [args.includeInstallFee=false]  true on a subscription's first invoice.
 * @param {number} [args.vatRate=0]  a fraction, e.g. 0.12. 0 means no VAT.
 * @param {Array<{kind: string, description: string, amount: number|string}>} [args.extraLines=[]]
 *   carried-over one-off charges from `pending_charges`. Signed, so a credit is
 *   negative. They run through the same subtotal/tax maths as everything else,
 *   so a carried charge can never be left out of the total.
 * @returns {{ lines: Array, subtotal: string, fees: string, tax: string, total: string }}
 */
export const buildInvoiceComputation = ({
  plan,
  daysInMonth,
  serviceDays,
  includeInstallFee = false,
  vatRate = 0,
  extraLines = [],
}) => {
  const lines = [];
  const monthly = money(plan.monthlyPrice);

  if (serviceDays >= daysInMonth) {
    lines.push({
      kind: "plan",
      description: `${plan.name} — monthly`,
      qty: 1,
      unitPrice: monthly.toFixed(2),
      amount: monthly.toFixed(2),
    });
  } else {
    // Prorated. The amount comes from the UNROUNDED daily rate — rounding the
    // rate first and multiplying compounds the error into the customer's bill.
    const dailyRate = monthly.dividedBy(daysInMonth);
    lines.push({
      kind: "proration",
      description: `${plan.name} — ${serviceDays}/${daysInMonth} days`,
      qty: serviceDays,
      // Rounded for display only; the amount below does not derive from it.
      unitPrice: dailyRate.toFixed(2),
      amount: dailyRate.times(serviceDays).toFixed(2),
    });
  }

  // One-time installation fee, on the first invoice only.
  const installFee = money(plan.installFee ?? 0);
  if (includeInstallFee && installFee.greaterThan(0)) {
    lines.push({
      kind: "install_fee",
      description: "Installation fee",
      qty: 1,
      unitPrice: installFee.toFixed(2),
      amount: installFee.toFixed(2),
    });
  }

  // Carried-over one-off charges, after the recurring lines so the invoice
  // reads chronologically: this month's service first, then anything carried.
  for (const extra of extraLines) {
    const amount = toAmount(extra.amount);
    lines.push({
      kind: extra.kind,
      description: extra.description,
      qty: 1,
      unitPrice: amount,
      amount,
    });
  }

  const subtotal = sumAmounts(lines.filter((l) => !FEE_KINDS.has(l.kind)).map((l) => l.amount));
  const fees = sumAmounts(lines.filter((l) => FEE_KINDS.has(l.kind)).map((l) => l.amount));
  const taxable = money(subtotal).plus(money(fees));
  const tax = taxable.times(money(vatRate)).toFixed(2);
  const total = taxable.plus(money(tax)).toFixed(2);

  return { lines, subtotal, fees, tax, total };
};

/**
 * Recompute totals from a set of lines that already exist.
 *
 * The same arithmetic as above, split out so adding an adjustment line to an
 * issued invoice cannot drift from how the invoice was originally computed.
 *
 * @param {Array<{kind: string, amount: number|string}>} lines
 * @param {number} [vatRate=0]
 * @returns {{ subtotal: string, fees: string, tax: string, total: string }}
 */
export const computeTotalsFromLines = (lines, vatRate = 0) => {
  const subtotal = sumAmounts(lines.filter((l) => !FEE_KINDS.has(l.kind)).map((l) => l.amount));
  const fees = sumAmounts(lines.filter((l) => FEE_KINDS.has(l.kind)).map((l) => l.amount));
  const taxable = money(subtotal).plus(money(fees));
  const tax = taxable.times(money(vatRate)).toFixed(2);
  const total = taxable.plus(money(tax)).toFixed(2);

  return { subtotal, fees, tax, total };
};

export default { FEE_KINDS, buildInvoiceComputation, computeTotalsFromLines };
