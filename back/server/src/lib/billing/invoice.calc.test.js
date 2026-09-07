import { describe, expect, it } from "vitest";

import { buildInvoiceComputation, computeTotalsFromLines } from "./invoice.calc.js";

const PLAN = { name: "Fiber 50", monthlyPrice: "1200.00", installFee: "1500.00" };

describe("buildInvoiceComputation — a full month", () => {
  it("charges the plan price once", () => {
    const result = buildInvoiceComputation({ plan: PLAN, daysInMonth: 31, serviceDays: 31 });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({
      kind: "plan",
      description: "Fiber 50 — monthly",
      qty: 1,
      amount: "1200.00",
    });
    expect(result.total).toBe("1200.00");
  });

  it("treats more service days than the month has as a full month", () => {
    // Defensive: an activation timestamp a day out must not produce a 32/31
    // proration line that reads as a bug to whoever gets the invoice.
    const result = buildInvoiceComputation({ plan: PLAN, daysInMonth: 31, serviceDays: 32 });

    expect(result.lines[0].kind).toBe("plan");
    expect(result.total).toBe("1200.00");
  });

  it("returns amounts as 2dp strings, not floats", () => {
    const result = buildInvoiceComputation({ plan: PLAN, daysInMonth: 31, serviceDays: 31 });

    expect(typeof result.total).toBe("string");
    expect(typeof result.lines[0].amount).toBe("string");
  });
});

describe("buildInvoiceComputation — proration", () => {
  it("bills the daily rate for the days served", () => {
    const result = buildInvoiceComputation({ plan: PLAN, daysInMonth: 31, serviceDays: 16 });

    expect(result.lines[0]).toMatchObject({
      kind: "proration",
      description: "Fiber 50 — 16/31 days",
      qty: 16,
    });
    // 1200 / 31 = 38.709677…; × 16 = 619.354…, rounded once at the end.
    expect(result.lines[0].amount).toBe("619.35");
    expect(result.total).toBe("619.35");
  });

  it("prorates from the unrounded daily rate", () => {
    // Rounding the daily rate to 38.71 first and multiplying gives 619.36 —
    // a centavo the customer did not owe, and the reason money.js exists.
    const result = buildInvoiceComputation({ plan: PLAN, daysInMonth: 31, serviceDays: 16 });

    expect(result.lines[0].unitPrice).toBe("38.71");
    expect(result.lines[0].amount).not.toBe("619.36");
    expect(result.lines[0].amount).toBe("619.35");
  });

  it("handles a price that does not divide evenly, over a whole month", () => {
    // 999.99 / 30 = 33.333; × 30 must come back to exactly the monthly price.
    const plan = { name: "Fiber 20", monthlyPrice: "999.99", installFee: "0" };
    const result = buildInvoiceComputation({ plan, daysInMonth: 30, serviceDays: 29 });

    expect(result.lines[0].amount).toBe("966.66");
  });

  it("bills one day for a subscription activated on the last day", () => {
    const result = buildInvoiceComputation({ plan: PLAN, daysInMonth: 31, serviceDays: 1 });

    expect(result.lines[0].amount).toBe("38.71");
  });

  it("prorates against February's shorter month", () => {
    // 1200 / 28 = 42.857…; × 14 = 600.00 exactly.
    const result = buildInvoiceComputation({ plan: PLAN, daysInMonth: 28, serviceDays: 14 });

    expect(result.lines[0].description).toBe("Fiber 50 — 14/28 days");
    expect(result.lines[0].amount).toBe("600.00");
  });
});

describe("buildInvoiceComputation — the installation fee", () => {
  it("is added only when asked for", () => {
    const first = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 31,
      includeInstallFee: true,
    });
    const later = buildInvoiceComputation({ plan: PLAN, daysInMonth: 31, serviceDays: 31 });

    expect(first.lines.map((l) => l.kind)).toEqual(["plan", "install_fee"]);
    expect(later.lines.map((l) => l.kind)).toEqual(["plan"]);
  });

  it("is reported as a fee, not in the subtotal, but is still in the total", () => {
    const result = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 31,
      includeInstallFee: true,
    });

    expect(result.subtotal).toBe("1200.00");
    expect(result.fees).toBe("1500.00");
    expect(result.total).toBe("2700.00");
  });

  it("adds no line when the plan's install fee is zero", () => {
    const plan = { name: "Fiber 50", monthlyPrice: "1200.00", installFee: "0.00" };
    const result = buildInvoiceComputation({
      plan,
      daysInMonth: 31,
      serviceDays: 31,
      includeInstallFee: true,
    });

    expect(result.lines).toHaveLength(1);
    expect(result.fees).toBe("0.00");
  });

  it("treats a missing install fee as zero", () => {
    const plan = { name: "Fiber 50", monthlyPrice: "1200.00" };
    const result = buildInvoiceComputation({
      plan,
      daysInMonth: 31,
      serviceDays: 31,
      includeInstallFee: true,
    });

    expect(result.lines).toHaveLength(1);
    expect(result.total).toBe("1200.00");
  });

  it("stacks with proration on a mid-month first invoice", () => {
    const result = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 16,
      includeInstallFee: true,
    });

    expect(result.subtotal).toBe("619.35");
    expect(result.fees).toBe("1500.00");
    expect(result.total).toBe("2119.35");
  });
});

describe("buildInvoiceComputation — carried charges", () => {
  it("appends them after the recurring lines", () => {
    const result = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 31,
      extraLines: [{ kind: "reconnection_fee", description: "Reconnection", amount: "300.00" }],
    });

    expect(result.lines.map((l) => l.kind)).toEqual(["plan", "reconnection_fee"]);
  });

  it("counts a reconnection fee as a fee", () => {
    const result = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 31,
      extraLines: [{ kind: "reconnection_fee", description: "Reconnection", amount: "300.00" }],
    });

    expect(result.subtotal).toBe("1200.00");
    expect(result.fees).toBe("300.00");
    expect(result.total).toBe("1500.00");
  });

  it("reduces the bill when the carried amount is negative", () => {
    // How an outage credit is applied: a negative line, not a separate
    // mechanism, so it goes through the same tax and total arithmetic.
    const result = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 31,
      extraLines: [{ kind: "credit", description: "Outage credit — 3 days", amount: "-116.13" }],
    });

    expect(result.subtotal).toBe("1083.87");
    expect(result.total).toBe("1083.87");
  });

  it("sums several carried charges exactly", () => {
    const result = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 31,
      extraLines: [
        { kind: "debit", description: "Router", amount: "0.10" },
        { kind: "debit", description: "Cable", amount: "0.20" },
      ],
    });

    // 0.1 + 0.2 is 0.30000000000000004 in float arithmetic. Here it is 0.30.
    expect(result.subtotal).toBe("1200.30");
  });

  it("can take the total below zero when credits exceed the charge", () => {
    const result = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 31,
      extraLines: [{ kind: "credit", description: "Goodwill", amount: "-1500.00" }],
    });

    expect(result.total).toBe("-300.00");
  });
});

describe("buildInvoiceComputation — VAT", () => {
  it("applies nothing at the default rate of zero", () => {
    const result = buildInvoiceComputation({ plan: PLAN, daysInMonth: 31, serviceDays: 31 });

    expect(result.tax).toBe("0.00");
    expect(result.total).toBe("1200.00");
  });

  it("taxes the subtotal and the fees together", () => {
    const result = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 31,
      includeInstallFee: true,
      vatRate: 0.12,
    });

    // (1200 + 1500) × 0.12 = 324.00
    expect(result.tax).toBe("324.00");
    expect(result.total).toBe("3024.00");
  });

  it("rounds tax half-up rather than truncating", () => {
    const plan = { name: "Odd", monthlyPrice: "100.05", installFee: "0" };
    const result = buildInvoiceComputation({
      plan,
      daysInMonth: 31,
      serviceDays: 31,
      vatRate: 0.12,
    });

    // 100.05 × 0.12 = 12.006 → 12.01
    expect(result.tax).toBe("12.01");
    expect(result.total).toBe("112.06");
  });
});

describe("computeTotalsFromLines", () => {
  it("reaches the same totals as the builder for the same lines", () => {
    const built = buildInvoiceComputation({
      plan: PLAN,
      daysInMonth: 31,
      serviceDays: 16,
      includeInstallFee: true,
      vatRate: 0.12,
    });
    const recomputed = computeTotalsFromLines(built.lines, 0.12);

    expect(recomputed).toEqual({
      subtotal: built.subtotal,
      fees: built.fees,
      tax: built.tax,
      total: built.total,
    });
  });

  it("handles DECIMAL columns arriving as JS numbers", () => {
    // What `decimalNumbers: true` actually hands back when these lines are read
    // from the database rather than built in memory.
    const totals = computeTotalsFromLines(
      [
        { kind: "plan", amount: 1200 },
        { kind: "install_fee", amount: 1500 },
      ],
      0
    );

    expect(totals).toEqual({
      subtotal: "1200.00",
      fees: "1500.00",
      tax: "0.00",
      total: "2700.00",
    });
  });

  it("returns zeroes for an invoice with no lines", () => {
    expect(computeTotalsFromLines([], 0.12)).toEqual({
      subtotal: "0.00",
      fees: "0.00",
      tax: "0.00",
      total: "0.00",
    });
  });
});
