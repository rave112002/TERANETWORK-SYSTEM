import { describe, expect, it } from "vitest";

import { normalizePaymentReference, REFERENCE_PATTERN } from "./reference.js";
import { recordPaymentSchema } from "../../validators/billing.validator.js";

const base = { invoiceId: "inv-1", amount: "1299.00" };
const parse = (body) => recordPaymentSchema.safeParse({ ...base, ...body });
const referenceError = (result) =>
  result.error?.issues.find((i) => i.path.join(".") === "referenceNo")?.message;

describe("normalizePaymentReference", () => {
  it("collapses the ways the same GCash reference gets copied into one key", () => {
    const forms = ["1234 567 890123", "1234567890123", " 1234-567-890123 ", "1234.567.890123"];
    const keys = new Set(forms.map(normalizePaymentReference));
    expect([...keys]).toEqual(["1234567890123"]);
  });

  it("upper-cases alphanumeric references so case cannot dodge the unique key", () => {
    expect(normalizePaymentReference("qrph-ab12cd34")).toBe("QRPHAB12CD34");
  });

  it("returns an empty string for nothing", () => {
    expect(normalizePaymentReference(null)).toBe("");
    expect(normalizePaymentReference(undefined)).toBe("");
    expect(normalizePaymentReference("  - ")).toBe("");
  });

  it("accepts a normal GCash reference and rejects punctuation it does not strip", () => {
    expect(REFERENCE_PATTERN.test("1234567890123")).toBe(true);
    expect(REFERENCE_PATTERN.test("12345")).toBe(false);
    expect(REFERENCE_PATTERN.test("1234#567890")).toBe(false);
  });
});

describe("recordPaymentSchema — reference numbers", () => {
  it("requires a reference for GCash", () => {
    const result = parse({ channel: "GCASH" });
    expect(result.success).toBe(false);
    expect(referenceError(result)).toMatch(/reference number/i);
  });

  it("requires a reference for QR Ph", () => {
    expect(parse({ channel: "QRPH", referenceNo: "" }).success).toBe(false);
  });

  it("hands the controller the normalised reference, not what was typed", () => {
    const result = parse({ channel: "GCASH", referenceNo: "1234 567 890123" });
    expect(result.success).toBe(true);
    expect(result.data.referenceNo).toBe("1234567890123");
  });

  it("refuses a reference on a cash payment", () => {
    const result = parse({ channel: "CASH", referenceNo: "1234567890123" });
    expect(result.success).toBe(false);
    expect(referenceError(result)).toMatch(/cash/i);
  });

  it("treats a blank or separator-only reference as none", () => {
    expect(parse({ channel: "CASH", referenceNo: "" }).success).toBe(true);
    expect(parse({ channel: "CASH", referenceNo: null }).success).toBe(true);
    expect(parse({ channel: "GCASH", referenceNo: " - " }).success).toBe(false);
  });

  it("leaves the reference optional for bank transfers, but still checks its shape", () => {
    expect(parse({ channel: "BANK_TRANSFER" }).success).toBe(true);
    expect(parse({ channel: "BANK_TRANSFER", referenceNo: "FT26091700123" }).success).toBe(true);
    expect(parse({ channel: "BANK_TRANSFER", referenceNo: "12#45" }).success).toBe(false);
  });

  it("rejects a reference too short to be a transaction id", () => {
    const result = parse({ channel: "GCASH", referenceNo: "12345" });
    expect(referenceError(result)).toMatch(/6–64/);
  });
});
