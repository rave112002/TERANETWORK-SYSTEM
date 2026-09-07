import fs from "node:fs/promises";
import path from "node:path";

import { renderInvoicePdf } from "../pdf/invoicePdf.js";
import { buildPayUrl, renderPayQrDataUrl } from "../qr/payQr.js";
import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";

/**
 * Loading an invoice for rendering, and turning it into a PDF on disk.
 *
 * ── Why PDFs are not in `public/` ───────────────────────────────────────────
 *
 * Everything else the system stores is an upload under `public/uploads/…`,
 * served straight by `express.static`. An invoice is different: it carries a
 * customer's name, address, account number and what they owe. A file under
 * `public/` is readable by anyone who can construct the path, and invoice
 * numbers are sequential, so "guess the path" is a one-line loop.
 *
 * So they go in `back/storage/invoices/…`, which nothing serves statically, and
 * reach a reader only through an endpoint that checks either a session or the
 * invoice's own `publicToken`.
 */

/** Where generated PDFs live. Deliberately outside anything served statically. */
export const STORAGE_ROOT = path.resolve(process.cwd(), "storage", "invoices");

/**
 * Load one invoice with everything needed to render it.
 *
 * @param {Object} db
 * @param {string} invoiceId
 * @returns {Promise<{invoice: Object, customer: Object, company: Object}|null>}
 */
export const loadInvoiceForRender = async (db, invoiceId) => {
  const rows = await db.query(
    `SELECT i.*, c.name AS customerName, c.accountNo, c.address AS customerAddress,
            c.email AS customerEmail, c.phone AS customerPhone,
            co.name AS companyName, co.address AS companyAddress, co.phone AS companyPhone,
            co.email AS companyEmail, co.tin AS companyTin, co.logoUrl AS companyLogoUrl
       FROM invoices i
       JOIN customers c ON c.customerId = i.customerId
       JOIN companies co ON co.companyId = i.companyId
      WHERE i.invoiceId = ? LIMIT 1`,
    [invoiceId]
  );

  const row = rows[0];
  if (!row) return null;

  const lines = await db.query(
    `SELECT invoiceLineId, kind, description, qty, unitPrice, amount
       FROM invoice_lines WHERE invoiceId = ? ORDER BY sortOrder, id`,
    [invoiceId]
  );

  return {
    invoice: { ...row, lines },
    customer: {
      customerId: row.customerId,
      name: row.customerName,
      accountNo: row.accountNo,
      address: row.customerAddress,
      email: row.customerEmail,
      phone: row.customerPhone,
    },
    company: {
      name: row.companyName,
      address: row.companyAddress,
      phone: row.companyPhone,
      email: row.companyEmail,
      tin: row.companyTin,
      logoUrl: row.companyLogoUrl,
    },
  };
};

/**
 * Read the company logo off disk as a data URI so the PDF renderer never makes
 * a network request while rendering.
 *
 * A missing or unreadable logo is not an error worth failing an invoice over —
 * the document falls back to the company name in text.
 *
 * @param {string|null} logoUrl a `/public/uploads/…` path.
 * @returns {Promise<string|null>}
 */
const readLogoDataUrl = async (logoUrl) => {
  if (!logoUrl) return null;

  try {
    const relative = logoUrl.replace(/^\/?(public\/)?/, "");
    const abs = path.resolve(process.cwd(), "public", relative);
    // Refuse anything that escapes the uploads root — the column is written by
    // an upload handler today, but a path traversal here would read any file
    // on the box into a customer-facing document.
    const root = path.resolve(process.cwd(), "public");
    if (!abs.startsWith(root + path.sep)) return null;

    const buffer = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
};

/**
 * Render an invoice to a PDF on disk and record the path on the row.
 *
 * Regenerating is safe and overwrites: the PDF is a projection of the invoice,
 * not a second source of truth, so an invoice that has been voided or paid
 * since it was first rendered produces a document that says so.
 *
 * @param {Object} db
 * @param {string} invoiceId
 * @returns {Promise<{filePath: string, relativePath: string, bytes: number}>}
 */
export const generateInvoicePdf = async (db, invoiceId) => {
  const loaded = await loadInvoiceForRender(db, invoiceId);
  if (!loaded) throw new Error(`Invoice ${invoiceId} not found`);

  const { invoice, customer, company } = loaded;

  const payUrl = buildPayUrl(invoice.publicToken);
  const qrDataUrl = await renderPayQrDataUrl(payUrl);
  const logoDataUrl = await readLogoDataUrl(company.logoUrl);

  const buffer = await renderInvoicePdf({
    invoice,
    customer,
    company: { ...company, logoDataUrl },
    qrDataUrl,
    payUrl,
  });

  // Foldered by company and year so a directory stays browsable at a few
  // thousand invoices a year rather than becoming one flat pile.
  const year = String(invoice.billingPeriodStart).slice(0, 4);
  const dir = path.join(STORAGE_ROOT, invoice.companyId, year);
  await fs.mkdir(dir, { recursive: true });

  const fileName = `${invoice.invoiceNo}.pdf`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);

  const relativePath = path.posix.join("invoices", invoice.companyId, year, fileName);

  await db.query(`UPDATE invoices SET pdfPath = ?, dateUpdated = ? WHERE invoiceId = ?`, [
    relativePath,
    getCurrentTimestampLocal(),
    invoiceId,
  ]);

  return { filePath, relativePath, bytes: buffer.length };
};

/**
 * The absolute path of an invoice's stored PDF, generating it if it is missing.
 *
 * @param {Object} db
 * @param {Object} invoice a row with `invoiceId` and `pdfPath`.
 * @returns {Promise<string>}
 */
export const ensureInvoicePdf = async (db, invoice) => {
  if (invoice.pdfPath) {
    const abs = path.resolve(process.cwd(), "storage", invoice.pdfPath);
    try {
      await fs.access(abs);
      return abs;
    } catch {
      // Recorded but gone — a restore that missed the storage volume, say.
      // Rendering again is cheaper than making a customer wait for support.
    }
  }

  const { filePath } = await generateInvoicePdf(db, invoice.invoiceId);
  return filePath;
};

export default { STORAGE_ROOT, loadInvoiceForRender, generateInvoicePdf, ensureInvoicePdf };
