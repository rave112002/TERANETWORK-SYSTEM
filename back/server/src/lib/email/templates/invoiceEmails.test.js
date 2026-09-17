import { describe, expect, it } from "vitest";

import { buildInvoiceIssuedEmail, buildInvoiceNoticeEmail } from "./invoiceEmails.js";
import { paymentInstructionLines } from "../../payments/instructions.js";

const invoice = {
  invoiceNo: "INV-2026-000001",
  total: "1399.00",
  dueDate: "2026-09-25",
  billingPeriodStart: "2026-09-01",
  billingPeriodEnd: "2026-09-30",
  lines: [{ description: "Fiber 50", amount: "1399.00" }],
};
const customer = { name: "Ana <Reyes>", accountNo: "ACC-000001" };
const facebookPageUrl = "https://facebook.com/teranetwork";
const paymentLines = paymentInstructionLines({
  instructions: { gcashNumber: "0912 3456 789", gcashAccountName: "TERANETWORK", facebookPageUrl },
  total: invoice.total,
  accountNo: customer.accountNo,
});

describe("billing emails — how to pay", () => {
  it("puts the GCash instructions in both parts, with no pay link", () => {
    const { html, text } = buildInvoiceIssuedEmail({
      invoice,
      customer,
      paymentLines,
      facebookPageUrl,
    });
    expect(text).toContain("How to pay:");
    expect(text).toContain("0912 3456 789 (TERANETWORK)");
    expect(html).toContain(`<a href="${facebookPageUrl}"`);
    expect(html).not.toMatch(/Pay now|Pay online/);
  });

  it("still escapes customer-supplied text", () => {
    const { html } = buildInvoiceIssuedEmail({ invoice, customer, paymentLines, facebookPageUrl });
    expect(html).toContain("Ana &lt;Reyes&gt;");
  });

  it("carries the same instructions on every notice", () => {
    for (const kind of ["reminder", "final", "overdue"]) {
      const { text } = buildInvoiceNoticeEmail({
        kind,
        invoice,
        customer,
        paymentLines,
        facebookPageUrl,
        graceDays: 0,
      });
      expect(text).toContain(paymentLines[0]);
    }
  });
});
