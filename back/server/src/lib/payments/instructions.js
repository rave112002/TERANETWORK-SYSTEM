import { formatAmount } from "../money/money.js";

/**
 * How a customer pays: the text on every invoice PDF and billing email
 * (docs/decisions.md D9, docs/payments.md).
 *
 * The GCash number, account name and Facebook page come from the branch's
 * admin Settings, so staff can change them without a deploy. They are read
 * when the document is made, so an invoice rendered after a change carries the
 * new number.
 *
 * ── Blank settings do not block billing ─────────────────────────────────────
 *
 * An invoice without a GCash number still goes out and says to contact us.
 * Holding the bill back because a setting is empty would be worse.
 */

/** The Settings keys a customer-facing billing document reads. */
export const PAYMENT_SETTING_KEYS = [
  "gcashNumber",
  "gcashAccountName",
  "facebookPageUrl",
  "invoiceTerms",
];

/**
 * @param {Object} db
 * @param {{companyId: string, branchId: string}} scope the invoice's own branch.
 * @returns {Promise<{gcashNumber: string|null, gcashAccountName: string|null,
 *   facebookPageUrl: string|null, invoiceTerms: string|null}>}
 */
export const getPaymentInstructions = async (db, { companyId, branchId }) => {
  const rows = await db.query(
    `SELECT settingKey, settingValue FROM settings
      WHERE companyId = ? AND branchId = ?
        AND settingKey IN (${PAYMENT_SETTING_KEYS.map(() => "?").join(", ")})`,
    [companyId, branchId, ...PAYMENT_SETTING_KEYS]
  );
  const stored = Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue || null]));
  return Object.fromEntries(PAYMENT_SETTING_KEYS.map((key) => [key, stored[key] ?? null]));
};

/**
 * The instructions as plain lines, shared by the PDF and the emails so the two
 * can never say different things.
 *
 * @param {Object} args
 * @param {{gcashNumber?: string|null, gcashAccountName?: string|null, facebookPageUrl?: string|null}} args.instructions
 * @param {string|number} args.total
 * @param {string} [args.accountNo]
 * @param {string} [args.companyName]
 * @returns {string[]}
 */
export const paymentInstructionLines = ({
  instructions,
  total,
  accountNo,
  companyName = "TERANETWORK",
}) => {
  const { gcashNumber, gcashAccountName, facebookPageUrl } = instructions ?? {};

  if (!gcashNumber) {
    return [
      facebookPageUrl
        ? `To pay, message ${companyName} on Facebook: ${facebookPageUrl}`
        : `To pay, please contact ${companyName}.`,
    ];
  }

  const to = gcashAccountName ? `${gcashNumber} (${gcashAccountName})` : gcashNumber;
  const steps = [
    [
      `Send ${formatAmount(total)} by GCash to ${to}.`,
      `Paying from Maya or a bank app? Send it to the same GCash number.`,
    ],
    // The client already asks for this in the GCash message. The account
    // number, not the name, because names repeat and get misspelled.
    ...(accountNo
      ? [[`Before sending, write your account number ${accountNo} in the GCash message.`]]
      : []),
    // The link sits alone on its own line: punctuation after a URL gets pulled
    // into it by email clients and PDF readers, and the link then 404s.
    facebookPageUrl
      ? [`Send a screenshot of your payment to our Facebook page:`, facebookPageUrl]
      : [`Send a screenshot of your payment to ${companyName}.`],
  ];

  return steps.flatMap(([first, ...rest], i) => [
    `${i + 1}. ${first}`,
    ...rest.map((line) => `   ${line}`),
  ]);
};

export default { PAYMENT_SETTING_KEYS, getPaymentInstructions, paymentInstructionLines };
