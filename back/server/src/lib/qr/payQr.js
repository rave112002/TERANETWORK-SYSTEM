import QRCode from "qrcode";

/**
 * QR codes for invoice payment links.
 *
 * ── What the QR encodes, and why it matters ─────────────────────────────────
 *
 * Always this system's own `/pay/<token>` URL, never a payment gateway's link.
 *
 * A gateway payment link expires — Xendit's default is 24 hours, and an invoice
 * is issued on the 15th and due on the 2nd. A QR printed on a statement will be
 * scanned by somebody on the 30th, and it has to work. Pointing at our page
 * means the token stays valid for the life of the invoice and the page decides
 * what to do: show a fresh gateway link, say it is already paid, or say it was
 * voided. A dead gateway URL can say none of those.
 */

/**
 * The customer-facing payment URL for an invoice.
 *
 * @param {string} publicToken the invoice's `publicToken`.
 * @returns {string}
 */
export const buildPayUrl = (publicToken) => {
  const base = (process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/pay/${publicToken}`;
};

/**
 * Render a payment link as a PNG data URI, ready to embed in the PDF.
 *
 * Error-correction level M, which tolerates ~15% damage — enough for a
 * statement that has been folded, faxed or photographed off a screen, without
 * the density that makes a phone camera struggle.
 *
 * @param {string} payUrl
 * @param {Object} [opts]
 * @param {number} [opts.width=320] pixels; 320 keeps it crisp at print size.
 * @returns {Promise<string>} `data:image/png;base64,…`
 */
export const renderPayQrDataUrl = async (payUrl, { width = 320 } = {}) =>
  QRCode.toDataURL(payUrl, {
    width,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

export default { buildPayUrl, renderPayQrDataUrl };
