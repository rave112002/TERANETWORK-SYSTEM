import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatAmount } from "../money/money.js";

/**
 * Invoice PDF rendering, with @react-pdf/renderer — pure JS, no headless
 * browser to install, keep patched, or watch leak memory on a small VPS.
 *
 * The document is built with `React.createElement` (aliased `e`) because the
 * backend has no JSX build step. Fonts are the built-in Helvetica family, so
 * the renderer needs no network access and no font files on disk.
 *
 * Amounts are formatted through money.js rather than `Intl.NumberFormat`, so
 * the figure on the PDF is the same string the invoice was computed with. A
 * document that disagrees with the total by a centavo is worse than no
 * document.
 */

const e = React.createElement;

const amount = (v) => formatAmount(v ?? 0);

/** DATE columns already arrive as 'YYYY-MM-DD' strings; anything else is trimmed. */
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a1a", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  logo: { height: 34, marginBottom: 6, objectFit: "contain" },
  muted: { color: "#6b7280", fontSize: 9 },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  label: { color: "#6b7280", fontSize: 8, marginBottom: 2, textTransform: "uppercase" },
  right: { textAlign: "right" },
  table: { borderTopWidth: 1, borderTopColor: "#e0e0e0", marginBottom: 12 },
  trow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  thead: { borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  cDesc: { width: "75%", color: "#353a3e" },
  cAmt: { width: "25%", textAlign: "right" },
  totals: { alignItems: "flex-end", marginTop: 8 },
  totalLine: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 4 },
  paid: { marginTop: 10, fontSize: 11, fontFamily: "Helvetica-Bold", color: "#15803d" },
  void: { marginTop: 10, fontSize: 11, fontFamily: "Helvetica-Bold", color: "#b91c1c" },
  qrRow: { marginTop: 28, alignItems: "center" },
  qr: { width: 120, height: 120, marginBottom: 4 },
  footer: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#e0e0e0", paddingTop: 8 },
});

/**
 * Render one invoice to a PDF buffer.
 *
 * @param {Object} args
 * @param {Object} args.invoice the invoice row, with `lines`.
 * @param {{name: string, accountNo?: string, address?: string, email?: string}} args.customer
 * @param {{name?: string, address?: string, phone?: string, email?: string, tin?: string, logoDataUrl?: string}} [args.company]
 * @param {string} [args.qrDataUrl] the pay-link QR as a data URI.
 * @param {string} [args.payUrl]
 * @returns {Promise<Buffer>}
 */
export const renderInvoicePdf = async ({
  invoice,
  customer,
  company = {},
  qrDataUrl,
  payUrl,
}) => {
  const lineRows = (invoice.lines || []).map((l, i) =>
    e(View, { key: `line-${i}`, style: styles.trow }, [
      e(Text, { key: "d", style: styles.cDesc }, l.description),
      e(Text, { key: "a", style: styles.cAmt }, amount(l.amount)),
    ])
  );

  const doc = e(
    Document,
    { title: `Invoice ${invoice.invoiceNo}` },
    e(Page, { size: "A4", style: styles.page }, [
      e(View, { key: "hdr", style: styles.headerRow }, [
        e(View, { key: "l" }, [
          company.logoDataUrl
            ? e(Image, { key: "logo", src: company.logoDataUrl, style: styles.logo })
            : null,
          e(Text, { key: "b", style: styles.brand }, company.name || "TERANETWORK"),
          company.address ? e(Text, { key: "ad", style: styles.muted }, company.address) : null,
          company.phone ? e(Text, { key: "ph", style: styles.muted }, company.phone) : null,
          company.tin ? e(Text, { key: "tin", style: styles.muted }, `TIN ${company.tin}`) : null,
        ]),
        e(View, { key: "r", style: styles.right }, [
          e(Text, { key: "no", style: styles.h1 }, `Invoice ${invoice.invoiceNo}`),
          e(Text, { key: "st", style: styles.muted }, `Status: ${invoice.status}`),
        ]),
      ]),

      e(View, { key: "meta", style: styles.metaRow }, [
        e(View, { key: "to" }, [
          e(Text, { key: "lbl", style: styles.label }, "Bill to"),
          e(Text, { key: "nm" }, customer.name),
          customer.accountNo
            ? e(Text, { key: "ac", style: styles.muted }, customer.accountNo)
            : null,
          customer.address ? e(Text, { key: "ad", style: styles.muted }, customer.address) : null,
        ]),
        e(View, { key: "dt", style: styles.right }, [
          e(Text, { key: "plbl", style: styles.label }, "Billing period"),
          e(
            Text,
            { key: "p", style: styles.muted },
            `${dateOnly(invoice.billingPeriodStart)} – ${dateOnly(invoice.billingPeriodEnd)}`
          ),
          e(
            Text,
            { key: "sd", style: styles.muted },
            `Statement: ${dateOnly(invoice.statementDate)}`
          ),
          e(Text, { key: "du" }, `Due: ${dateOnly(invoice.dueDate)}`),
        ]),
      ]),

      e(View, { key: "tbl", style: styles.table }, [
        e(View, { key: "head", style: [styles.trow, styles.thead] }, [
          e(Text, { key: "d", style: styles.cDesc }, "Description"),
          e(Text, { key: "a", style: styles.cAmt }, "Amount"),
        ]),
        ...lineRows,
      ]),

      e(View, { key: "tot", style: styles.totals }, [
        e(Text, { key: "sub", style: styles.muted }, `Subtotal: ${amount(invoice.subtotal)}`),
        e(Text, { key: "fee", style: styles.muted }, `Fees: ${amount(invoice.fees)}`),
        e(Text, { key: "tax", style: styles.muted }, `Tax: ${amount(invoice.tax)}`),
        e(Text, { key: "ttl", style: styles.totalLine }, `Total due: ${amount(invoice.total)}`),
      ]),

      // Paid and void are said in words, not just in a status field somebody
      // has to interpret — this document gets printed, filed and argued over.
      invoice.status === "paid"
        ? e(
            Text,
            { key: "paid", style: styles.paid },
            `PAID${invoice.paidAt ? ` — ${dateOnly(invoice.paidAt)}` : ""}`
          )
        : null,
      invoice.status === "void"
        ? e(Text, { key: "void", style: styles.void }, "VOID — this invoice is not payable")
        : null,

      // No payment QR on an invoice that must not be paid.
      qrDataUrl && invoice.status !== "paid" && invoice.status !== "void"
        ? e(View, { key: "qr", style: styles.qrRow }, [
            e(Image, { key: "img", src: qrDataUrl, style: styles.qr }),
            e(Text, { key: "cap", style: styles.muted }, "Scan to pay"),
            payUrl ? e(Text, { key: "url", style: styles.muted }, payUrl) : null,
          ])
        : null,

      e(View, { key: "ft", style: styles.footer }, [
        e(
          Text,
          { key: "f1", style: styles.muted },
          company.email
            ? `Questions about this invoice? ${company.email}`
            : "Questions about this invoice? Contact your service provider."
        ),
      ]),
    ])
  );

  return renderToBuffer(doc);
};

export default { renderInvoicePdf };
