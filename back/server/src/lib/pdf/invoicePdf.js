import React from "react";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatAmount, isZeroAmount } from "../money/money.js";

/**
 * Invoice PDF rendering, with @react-pdf/renderer — pure JS, no headless
 * browser to install, keep patched, or watch leak memory on a small VPS.
 *
 * ── The layout is the client's ──────────────────────────────────────────────
 *
 * It follows the invoice TERANETWORK already sends, so customers recognise it:
 * a coloured bar, the company name with the logo on the right, "Invoice for" and
 * "Invoice details" side by side, a Description / Plan / Amount table, the
 * grand total, a "How to pay" box, then terms and conditions.
 *
 * The document is built with `React.createElement` (aliased `e`) because the
 * backend has no JSX build step. Fonts are the built-in Helvetica family, so
 * the renderer needs no network access and no font files on disk. Helvetica
 * has no peso sign, which is why amounts read "PHP 699.00".
 *
 * Amounts are formatted through money.js rather than `Intl.NumberFormat`, so
 * the figure on the PDF is the same string the invoice was computed with.
 */

const e = React.createElement;

/** The two brand colours, in one place so a rebrand is a two-line change. */
const COLORS = {
  brand: "#2e3a8c",
  total: "#d6246e",
  text: "#1a1a1a",
  body: "#353a3e",
  muted: "#6b7280",
  line: "#d9dce1",
  box: "#f3f5f8",
};

const amount = (v) => formatAmount(v ?? 0);

/** 'YYYY-MM-DD…' → 'MM/DD/YYYY', the way the client's invoices write dates. */
const usDate = (v) => {
  const [y, m, d] = String(v ?? "")
    .slice(0, 10)
    .split("-");
  return y && m && d ? `${m}/${d}/${y}` : "";
};

/** What each kind of line is called in the Description column. */
const LINE_LABELS = {
  plan: "Subscription",
  proration: "Subscription (prorated)",
  install_fee: "Installation fee",
  reconnection_fee: "Reconnection fee",
  credit: "Credit",
  debit: "Charge",
  discount: "Discount",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingHorizontal: 40,
    paddingBottom: 40,
    fontSize: 10,
    color: COLORS.text,
    fontFamily: "Helvetica",
  },
  bar: { height: 8, backgroundColor: COLORS.brand, marginHorizontal: -40, marginBottom: 24 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  brand: { fontSize: 17, color: COLORS.brand },
  companyLine: { color: COLORS.muted, fontSize: 8.5, marginTop: 3, textTransform: "uppercase" },
  logo: { width: 90, height: 60, objectFit: "contain" },

  columns: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  column: { width: "46%" },
  sectionTitle: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    paddingBottom: 5,
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  customerName: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 5 },
  detail: { fontSize: 9, color: COLORS.body, marginBottom: 5 },
  detailLabel: { fontFamily: "Helvetica-Bold", color: COLORS.text },
  subTitle: { marginTop: 4 },

  table: { borderTopWidth: 1.5, borderTopColor: COLORS.line, marginTop: 4 },
  trow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eceef1",
  },
  thead: { color: COLORS.brand, fontFamily: "Helvetica-Bold" },
  cDesc: { width: "38%" },
  cPlan: { width: "37%" },
  cAmt: { width: "25%" },
  cell: { color: COLORS.body, fontSize: 9 },

  totals: { alignItems: "flex-end", marginTop: 12 },
  subtotal: { color: COLORS.muted, fontSize: 9, marginBottom: 2 },
  grandTotal: { fontSize: 14, fontFamily: "Helvetica-Bold", color: COLORS.total, marginTop: 4 },
  stamp: { marginTop: 6, fontSize: 11, fontFamily: "Helvetica-Bold" },

  howToPay: { marginTop: 22, padding: 14, backgroundColor: COLORS.box, borderRadius: 4 },
  howToPayTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 6 },
  howToPayLine: { marginBottom: 4, color: COLORS.body },
  // A step's second line ("Paying from Maya…", the Facebook link).
  howToPayMore: { paddingLeft: 12 },

  terms: { marginTop: 20, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 14 },
  termsTitle: { fontSize: 14, textAlign: "center", marginBottom: 8, color: COLORS.body },
  termsText: { color: COLORS.muted, fontSize: 9, lineHeight: 1.5 },

  footer: { marginTop: 18, color: COLORS.muted, fontSize: 8.5 },
});

const detail = (key, label, value) =>
  value
    ? e(Text, { key, style: styles.detail }, [
        e(Text, { key: "l", style: styles.detailLabel }, `${label}: `),
        String(value),
      ])
    : null;

/**
 * Render one invoice to a PDF buffer.
 *
 * @param {Object} args
 * @param {Object} args.invoice the invoice row, with `lines`.
 * @param {{name: string, accountNo?: string, address?: string, email?: string, phone?: string}} args.customer
 * @param {{name?: string, address?: string, phone?: string, email?: string, tin?: string, logoDataUrl?: string}} [args.company]
 * @param {string[]} [args.paymentLines] how to pay, from lib/payments/instructions.js.
 * @param {string|null} [args.terms] terms and conditions from Settings; the section is left out when blank.
 * @returns {Promise<Buffer>}
 */
export const renderInvoicePdf = ({ invoice, customer, company = {}, paymentLines = [], terms }) => {
  const payable = invoice.status !== "paid" && invoice.status !== "void";

  const lineRows = (invoice.lines || []).map((l, i) => {
    const label = LINE_LABELS[l.kind] ?? "Charge";
    return e(View, { key: `line-${i}`, style: styles.trow }, [
      e(Text, { key: "d", style: [styles.cDesc, styles.cell] }, label),
      // "Installation fee" in both columns reads as a mistake; say it once.
      e(
        Text,
        { key: "p", style: [styles.cPlan, styles.cell] },
        l.description === label ? "" : l.description
      ),
      e(Text, { key: "a", style: [styles.cAmt, styles.cell] }, amount(l.amount)),
    ]);
  });

  const companyLines = [company.address, company.phone, company.tin ? `TIN ${company.tin}` : null]
    .filter(Boolean)
    .join("  ·  ");

  const doc = e(
    Document,
    { title: `Invoice ${invoice.invoiceNo}` },
    e(Page, { size: "A4", style: styles.page }, [
      e(View, { key: "bar", style: styles.bar }),

      e(View, { key: "hdr", style: styles.headerRow }, [
        e(View, { key: "l", style: { width: "65%" } }, [
          e(Text, { key: "b", style: styles.brand }, company.name || "TERANETWORK"),
          companyLines ? e(Text, { key: "ad", style: styles.companyLine }, companyLines) : null,
        ]),
        company.logoDataUrl
          ? e(Image, { key: "logo", src: company.logoDataUrl, style: styles.logo })
          : null,
      ]),

      e(View, { key: "cols", style: styles.columns }, [
        e(View, { key: "for", style: styles.column }, [
          e(Text, { key: "t", style: styles.sectionTitle }, "Invoice for"),
          e(Text, { key: "nm", style: styles.customerName }, customer.name),
          customer.email ? e(Text, { key: "em", style: styles.detail }, customer.email) : null,
          customer.phone ? e(Text, { key: "ph", style: styles.detail }, customer.phone) : null,
          customer.address
            ? e(Text, { key: "at", style: [styles.sectionTitle, styles.subTitle] }, "Address")
            : null,
          customer.address ? e(Text, { key: "ad", style: styles.detail }, customer.address) : null,
        ]),
        e(View, { key: "det", style: styles.column }, [
          e(Text, { key: "t", style: styles.sectionTitle }, "Invoice details"),
          detail("no", "Invoice #", invoice.invoiceNo),
          detail("ac", "Account #", customer.accountNo),
          detail(
            "pd",
            "Billing period",
            `${usDate(invoice.billingPeriodStart)} – ${usDate(invoice.billingPeriodEnd)}`
          ),
          detail("du", "Due date", usDate(invoice.dueDate)),
        ]),
      ]),

      e(View, { key: "tbl", style: styles.table }, [
        e(View, { key: "head", style: styles.trow }, [
          e(Text, { key: "d", style: [styles.cDesc, styles.thead] }, "Description"),
          e(Text, { key: "p", style: [styles.cPlan, styles.thead] }, "Plan"),
          e(Text, { key: "a", style: [styles.cAmt, styles.thead] }, "Amount"),
        ]),
        ...lineRows,
      ]),

      e(View, { key: "tot", style: styles.totals }, [
        // Only when they apply: a "Fees: PHP 0.00" line is noise on a home bill.
        isZeroAmount(invoice.fees)
          ? null
          : e(Text, { key: "fee", style: styles.subtotal }, `Fees: ${amount(invoice.fees)}`),
        isZeroAmount(invoice.tax)
          ? null
          : e(Text, { key: "tax", style: styles.subtotal }, `Tax: ${amount(invoice.tax)}`),
        e(Text, { key: "ttl", style: styles.grandTotal }, `Grand Total: ${amount(invoice.total)}`),
        // Paid and void are said in words — this document gets printed, filed
        // and argued over.
        invoice.status === "paid"
          ? e(
              Text,
              { key: "paid", style: [styles.stamp, { color: "#15803d" }] },
              `PAID${invoice.paidAt ? ` — ${usDate(invoice.paidAt)}` : ""}`
            )
          : null,
        invoice.status === "void"
          ? e(
              Text,
              { key: "void", style: [styles.stamp, { color: "#b91c1c" }] },
              "VOID — this invoice is not payable"
            )
          : null,
      ]),

      // No payment instructions on an invoice that must not be paid.
      payable && paymentLines.length
        ? e(View, { key: "pay", style: styles.howToPay, wrap: false }, [
            e(Text, { key: "t", style: styles.howToPayTitle }, "How to pay"),
            // Leading spaces mark a continuation line in the shared text; the
            // PDF collapses spaces, so the indent is done with padding.
            ...paymentLines.map((line, i) =>
              e(
                Text,
                {
                  key: `l${i}`,
                  style: /^\s/.test(line)
                    ? [styles.howToPayLine, styles.howToPayMore]
                    : styles.howToPayLine,
                },
                line.trim()
              )
            ),
          ])
        : null,

      terms
        ? e(View, { key: "terms", style: styles.terms, wrap: false }, [
            e(Text, { key: "t", style: styles.termsTitle }, "Terms and Conditions"),
            e(Text, { key: "b", style: styles.termsText }, terms),
          ])
        : null,

      company.email
        ? e(
            Text,
            { key: "ft", style: styles.footer },
            `Questions about this invoice? ${company.email}`
          )
        : null,
    ])
  );

  return renderToBuffer(doc);
};

export default { renderInvoicePdf };
