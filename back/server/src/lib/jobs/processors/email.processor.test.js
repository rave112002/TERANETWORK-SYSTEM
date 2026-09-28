import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureInvoicePdf, loadInvoiceForRender } from "../../billing/invoice.render.js";
import { recordEmailEvent, sendEmail } from "../../email/email.service.js";
import { EMAIL_KINDS, emailProcessor } from "./email.processor.js";

vi.mock("node:fs/promises", () => ({ default: { readFile: vi.fn(() => Promise.resolve(Buffer.from("%PDF"))) } }));
vi.mock("../../billing/invoice.render.js", () => ({
  ensureInvoicePdf: vi.fn(),
  loadInvoiceForRender: vi.fn(),
}));
vi.mock("../../email/email.service.js", () => ({
  recordEmailEvent: vi.fn(() => Promise.resolve()),
  sendEmail: vi.fn(() => Promise.resolve({ messageId: "msg-1" })),
}));
vi.mock("../../payments/instructions.js", () => ({
  getPaymentInstructions: vi.fn(() => Promise.resolve({ facebookPageUrl: null })),
  paymentInstructionLines: vi.fn(() => []),
}));
vi.mock("../../settings/settings.service.js", () => ({ getBillingSchedule: vi.fn() }));

/**
 * One test, guarding one mistake.
 *
 * `email_events.type` is an ENUM. A renderer added here without widening that
 * column sends the message and then throws on the row that records it — after
 * the mail server already has it. The job retries, the customer gets the same
 * email again, and it repeats until the job dead-letters.
 *
 * That is not a hypothetical: the `final` notice shipped that way for the
 * length of one commit, and migration 012 is the fix.
 */
describe("email kinds and the email_events ENUM", () => {
  it("every kind the processor can send is a value the column accepts", () => {
    const schema = fs.readFileSync(
      path.resolve(process.cwd(), "database/schema.sql"),
      "utf8"
    );

    // Anchored on the table, not just on "type ENUM(": several tables have a
    // column called `type`, and matching the first one in the file silently
    // tested the wrong table's values.
    const table = schema.match(/CREATE TABLE IF NOT EXISTS email_events \(([\s\S]*?)\n\)/);
    expect(table, "could not find email_events in schema.sql").toBeTruthy();

    const column = table[1].match(/type ENUM\(([^)]+)\)/);
    expect(column, "could not find email_events.type").toBeTruthy();

    const accepted = column[1].match(/'([^']+)'/g).map((v) => v.replaceAll("'", ""));

    expect(EMAIL_KINDS.length).toBeGreaterThan(0);
    for (const kind of EMAIL_KINDS) {
      expect(accepted, `email_events.type has no '${kind}'`).toContain(kind);
    }
  });
});

/**
 * The PDF is the invoice. An "invoice issued" email without it is not sent at
 * all — the job fails, the queue retries, and the attempt is on record.
 */
describe("invoice_issued and its PDF", () => {
  const job = { jobId: "job-1", payload: { kind: "invoice_issued", invoiceId: "inv-1" } };
  const ctx = { db: {}, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };

  beforeEach(() => {
    vi.clearAllMocks();
    loadInvoiceForRender.mockResolvedValue({
      invoice: {
        invoiceId: "inv-1",
        invoiceNo: "INV-2026-000001",
        companyId: "co-1",
        customerId: "cu-1",
        status: "issued",
        total: "1299.00",
        dueDate: "2026-10-02",
        lines: [],
      },
      customer: { accountNo: "ACC-1", email: "juan@example.com", name: "Juan" },
      company: { name: "TERANETWORK" },
    });
  });

  it("does not send the email when the PDF cannot be built", async () => {
    ensureInvoicePdf.mockRejectedValue(new Error("logo file is locked"));

    await expect(emailProcessor(job, ctx)).rejects.toThrow("logo file is locked");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(recordEmailEvent).toHaveBeenCalledWith(
      ctx.db,
      expect.objectContaining({
        providerStatus: "failed",
        error: expect.stringContaining("invoice PDF could not be built"),
      })
    );
  });

  it("sends with the PDF attached when it builds", async () => {
    ensureInvoicePdf.mockResolvedValue("/tmp/INV-2026-000001.pdf");

    await expect(emailProcessor(job, ctx)).resolves.toMatchObject({ sent: true });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [expect.objectContaining({ filename: "INV-2026-000001.pdf" })],
      })
    );
  });
});
