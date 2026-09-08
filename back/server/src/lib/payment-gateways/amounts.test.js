import { describe, expect, it } from "vitest";

import {
  fromCentavos,
  fromWholePesos,
  toCentavos,
  toDecimalString,
  toWholePesos,
} from "./amounts.js";

/**
 * These tests exist because the failure they guard against is silent, expensive
 * and only visible on a customer's statement: a hundredfold billing error.
 */

describe("toWholePesos — Xendit's unit", () => {
  it("sends a whole amount as itself, not as centavos", () => {
    // The trap: 1200 must go as 1200, meaning PHP 1,200.00. Sending 120000
    // would charge a hundred times the subscription.
    expect(toWholePesos("1200.00")).toBe(1200);
    expect(toWholePesos("4999.00")).toBe(4999);
  });

  it("accepts a number as readily as a string", () => {
    expect(toWholePesos(1200)).toBe(1200);
  });

  it("handles zero", () => {
    expect(toWholePesos("0.00")).toBe(0);
  });

  it("refuses a fractional amount rather than rounding it away", () => {
    // Rounding here would hide the exact mistake this file exists to catch:
    // somebody passing centavos to a whole-peso gateway.
    expect(() => toWholePesos("1200.50")).toThrow(/whole pesos/);
    expect(() => toWholePesos("0.01")).toThrow(/whole pesos/);
  });

  it("names the amount it refused", () => {
    expect(() => toWholePesos("1200.50")).toThrow(/1200\.50/);
  });
});

describe("toCentavos — PayMongo's unit", () => {
  it("multiplies by a hundred", () => {
    expect(toCentavos("1200.00")).toBe(120000);
    expect(toCentavos("1200.50")).toBe(120050);
    expect(toCentavos("0.01")).toBe(1);
  });

  it("does not lose a centavo to floating point", () => {
    // In IEEE-754, 1200.10 * 100 is 120009.99999999999. Math.round would rescue
    // this one and fail another; decimal.js makes the whole class impossible.
    expect(toCentavos("1200.10")).toBe(120010);
    expect(toCentavos("1234.35")).toBe(123435);
    expect(toCentavos("0.29")).toBe(29);
    expect(toCentavos("19.99")).toBe(1999);
  });

  it("handles zero", () => {
    expect(toCentavos("0.00")).toBe(0);
  });

  it("returns an integer, never a float", () => {
    expect(Number.isInteger(toCentavos("1200.10"))).toBe(true);
    expect(Number.isInteger(toCentavos("999.99"))).toBe(true);
  });
});

describe("toDecimalString — Dragonpay's unit, and ours", () => {
  it("always carries two decimal places", () => {
    expect(toDecimalString(1200)).toBe("1200.00");
    expect(toDecimalString("1200.5")).toBe("1200.50");
    expect(toDecimalString("1200")).toBe("1200.00");
  });
});

describe("round trips", () => {
  it("survives whole pesos out and back", () => {
    expect(fromWholePesos(toWholePesos("1200.00"))).toBe("1200.00");
  });

  it("survives centavos out and back", () => {
    for (const amount of ["1200.00", "1200.10", "0.01", "999.99", "12345.67"]) {
      expect(fromCentavos(toCentavos(amount))).toBe(amount);
    }
  });

  it("reads a gateway's centavos back into canonical form", () => {
    expect(fromCentavos(120000)).toBe("1200.00");
    expect(fromCentavos(1)).toBe("0.01");
    expect(fromCentavos("120010")).toBe("1200.10");
  });

  it("reads a gateway's whole pesos back into canonical form", () => {
    expect(fromWholePesos(1200)).toBe("1200.00");
    expect(fromWholePesos("4999")).toBe("4999.00");
  });
});

describe("the difference between the units", () => {
  it("is exactly a hundredfold, which is the whole point", () => {
    // Stated as a test so the consequence of confusing them is written down
    // where somebody editing an adapter will read it.
    const amount = "1200.00";
    expect(toCentavos(amount)).toBe(toWholePesos(amount) * 100);
  });
});
