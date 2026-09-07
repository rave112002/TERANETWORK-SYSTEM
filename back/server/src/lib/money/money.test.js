import { describe, expect, it } from "vitest";

import {
  amountsEqual,
  applyRate,
  compareAmounts,
  formatAmount,
  isZeroAmount,
  lineAmount,
  money,
  sumAmounts,
  toAmount,
  toNumber,
} from "./money.js";

describe("money", () => {
  it("treats null and undefined as zero (a missing money column)", () => {
    expect(toAmount(null)).toBe("0.00");
    expect(toAmount(undefined)).toBe("0.00");
  });

  it("accepts the number the pool returns for a DECIMAL column", () => {
    // decimalNumbers: true means DECIMAL(12,2) arrives as a JS number.
    expect(toAmount(4999)).toBe("4999.00");
    expect(toAmount(1200.5)).toBe("1200.50");
  });

  it("accepts a string, in case the driver config ever changes", () => {
    expect(toAmount("4999.00")).toBe("4999.00");
  });
});

describe("float traps this file exists to avoid", () => {
  it("adds without the classic 0.1 + 0.2 error", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the reason this module exists
    expect(sumAmounts([0.1, 0.2])).toBe("0.30");
  });

  it("multiplies without drift", () => {
    expect(0.07 * 3).not.toBe(0.21);
    expect(lineAmount(3, 0.07)).toBe("0.21");
  });

  it("sums a realistic invoice exactly", () => {
    expect(sumAmounts([4999, 1000, -268.76])).toBe("5730.24");
  });
});

describe("rounding", () => {
  it("rounds half up, not half even", () => {
    expect(toAmount(2.005)).toBe("2.01"); // banker's rounding would give 2.00
    expect(toAmount(2.015)).toBe("2.02");
  });

  it("rounds once at the end, not per intermediate step", () => {
    // 16 days of a PHP 1,200 month over 31 days.
    const daily = money(1200).dividedBy(31);
    expect(toAmount(daily.times(16))).toBe("619.35");

    // Rounding the daily rate first loses a centavo — the bug this guards.
    const roundedDaily = money(toAmount(daily));
    expect(toAmount(roundedDaily.times(16))).toBe("619.36");
  });
});

describe("amountsEqual — the settlement rule", () => {
  it("matches an exact payment", () => {
    expect(amountsEqual(4999, "4999.00")).toBe(true);
    expect(amountsEqual(4999.0, 4999)).toBe(true);
  });

  it("rejects a payment a centavo short", () => {
    expect(amountsEqual(4999, 4998.99)).toBe(false);
  });

  it("survives float representation error that === would fail on", () => {
    const total = 0.1 + 0.2; // 0.30000000000000004
    expect(total === 0.3).toBe(false);
    expect(amountsEqual(total, 0.3)).toBe(true);
  });
});

describe("comparison helpers", () => {
  it("compares at 2dp", () => {
    expect(compareAmounts(100, 99.99)).toBeGreaterThan(0);
    expect(compareAmounts(99.99, 100)).toBeLessThan(0);
    expect(compareAmounts("100.00", 100)).toBe(0);
  });

  it("detects zero, including a value that only rounds to zero", () => {
    expect(isZeroAmount(0)).toBe(true);
    expect(isZeroAmount(null)).toBe(true);
    expect(isZeroAmount(0.001)).toBe(true);
    expect(isZeroAmount(0.01)).toBe(false);
  });
});

describe("rates and signed lines", () => {
  it("applies VAT at 0 and at 12%", () => {
    expect(applyRate(4999, 0)).toBe("0.00");
    expect(applyRate(4999, 0.12)).toBe("599.88");
  });

  it("keeps credits negative", () => {
    expect(lineAmount(1, -268.76)).toBe("-268.76");
    expect(sumAmounts([4999, -268.76])).toBe("4730.24");
  });
});

describe("display", () => {
  it("groups thousands", () => {
    expect(formatAmount(4999)).toBe("PHP 4,999.00");
    expect(formatAmount(1234567.5)).toBe("PHP 1,234,567.50");
    expect(formatAmount(999)).toBe("PHP 999.00");
  });

  it("keeps the minus sign in front", () => {
    expect(formatAmount(-268.76)).toBe("PHP -268.76");
  });
});

describe("toNumber", () => {
  it("returns a rounded number for API responses", () => {
    expect(toNumber("4999.004")).toBe(4999);
    expect(toNumber(0.1 + 0.2)).toBe(0.3);
  });
});
