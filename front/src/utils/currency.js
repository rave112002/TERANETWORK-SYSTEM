/**
 * Peso formatting for display.
 *
 * Display only — never do arithmetic on these values in the browser. Money is
 * computed server-side with exact decimals (`back/server/src/lib/money`), and
 * the API sends already-rounded amounts.
 */

const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * @param {number|string|null|undefined} value
 * @param {string} [fallback="—"] shown when there is no value at all
 * @returns {string} e.g. "₱4,999.00"
 */
export const formatPeso = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) ? PESO.format(amount) : fallback;
};

/**
 * Speed tier as "50 / 20 Mbps".
 * @param {number|string} down
 * @param {number|string} up
 */
export const formatSpeed = (down, up) => `${Number(down) || 0} / ${Number(up) || 0} Mbps`;
