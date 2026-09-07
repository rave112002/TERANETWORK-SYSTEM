import { describe, expect, it } from "vitest";

import {
  getAllSettings,
  getGraceDays,
  getSetting,
  getVatRate,
  isDryRun,
  isReconnectionFeeEnabled,
  parseBoolean,
  setSetting,
} from "./settings.service.js";

/** Fake `req.db` returning whatever settings a test wants. */
const fakeDb = (rows) => ({
  query: async () => rows,
});

const withValue = (value) => fakeDb([{ settingValue: value }]);
const missing = fakeDb([]);

const COMPANY = "co-1";

describe("parseBoolean", () => {
  it("accepts the spellings a settings screen actually produces", () => {
    for (const v of ["true", "TRUE", "1", "yes", "on", " True "]) {
      expect(parseBoolean(v)).toBe(true);
    }
    for (const v of ["false", "FALSE", "0", "no", "off", " False "]) {
      expect(parseBoolean(v)).toBe(false);
    }
  });

  it("falls back rather than guessing at junk", () => {
    // A typo must not silently leave the system rehearsing when staff think it
    // is live — nor the reverse.
    expect(parseBoolean("maybe", false)).toBe(false);
    expect(parseBoolean("maybe", true)).toBe(true);
    expect(parseBoolean(null, false)).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
  });
});

describe("getGraceDays — the `0 || 3` bug", () => {
  it("TREATS ZERO AS ZERO", async () => {
    // The whole point. `parseInt("0") || 3` is 3, which silently gave every
    // customer three extra days and made the sweep look broken with no error.
    // The client's corrected model sets this to 0.
    expect(await getGraceDays(withValue("0"), COMPANY)).toBe(0);
  });

  it("reads ordinary values", async () => {
    expect(await getGraceDays(withValue("3"), COMPANY)).toBe(3);
    expect(await getGraceDays(withValue("14"), COMPANY)).toBe(14);
  });

  it("falls back to 3 on junk — never to 0", async () => {
    // Erring toward MORE grace only delays a disconnection; erring toward less
    // cuts off paying customers early.
    for (const junk of ["", "abc", "null", "  "]) {
      expect(await getGraceDays(withValue(junk), COMPANY)).toBe(3);
    }
  });

  it("rejects negatives and absurd values", async () => {
    expect(await getGraceDays(withValue("-1"), COMPANY)).toBe(3);
    expect(await getGraceDays(withValue("9999"), COMPANY)).toBe(3);
  });

  it("falls back to 3 when the row is missing entirely", async () => {
    expect(await getGraceDays(missing, COMPANY)).toBe(3);
  });

  it("tolerates a value stored with whitespace", async () => {
    expect(await getGraceDays(withValue(" 0 "), COMPANY)).toBe(0);
  });
});

describe("isDryRun — the kill switch", () => {
  it("is off unless explicitly on", async () => {
    expect(await isDryRun(missing, COMPANY)).toBe(false);
    expect(await isDryRun(withValue("false"), COMPANY)).toBe(false);
    expect(await isDryRun(withValue("nonsense"), COMPANY)).toBe(false);
  });

  it("is on when set", async () => {
    expect(await isDryRun(withValue("true"), COMPANY)).toBe(true);
    expect(await isDryRun(withValue("1"), COMPANY)).toBe(true);
  });
});

describe("getVatRate", () => {
  it("is zero today", async () => {
    expect(await getVatRate(missing, COMPANY)).toBe(0);
    expect(await getVatRate(withValue("0"), COMPANY)).toBe(0);
  });

  it("reads a real rate when the client turns VAT on", async () => {
    expect(await getVatRate(withValue("0.12"), COMPANY)).toBe(0.12);
  });

  it("refuses a rate outside 0–1 rather than billing nonsense", async () => {
    // 12 instead of 0.12 would multiply every invoice by thirteen.
    expect(await getVatRate(withValue("12"), COMPANY)).toBe(0);
    expect(await getVatRate(withValue("-0.5"), COMPANY)).toBe(0);
    expect(await getVatRate(withValue("abc"), COMPANY)).toBe(0);
  });
});

describe("isReconnectionFeeEnabled", () => {
  it("is off by client decision", async () => {
    expect(await isReconnectionFeeEnabled(missing, COMPANY)).toBe(false);
  });

  it("can be turned on without a deploy", async () => {
    expect(await isReconnectionFeeEnabled(withValue("true"), COMPANY)).toBe(true);
  });
});

describe("getSetting", () => {
  it("returns the stored value", async () => {
    expect(await getSetting(withValue("hello"), COMPANY, "DRY_RUN")).toBe("hello");
  });

  it("falls back for a missing row", async () => {
    expect(await getSetting(missing, COMPANY, "DRY_RUN")).toBe("false");
  });

  it("falls back for a row explicitly stored as NULL", async () => {
    expect(await getSetting(fakeDb([{ settingValue: null }]), COMPANY, "GRACE_DAYS")).toBe("3");
  });

  it("returns null for a key it knows nothing about", async () => {
    expect(await getSetting(missing, COMPANY, "NOT_A_SETTING")).toBeNull();
  });
});

describe("getAllSettings", () => {
  it("fills in defaults for keys that have no row", async () => {
    const db = fakeDb([{ settingKey: "DRY_RUN", settingValue: "true" }]);
    const settings = await getAllSettings(db, COMPANY);
    expect(settings.DRY_RUN).toBe("true");
    expect(settings.GRACE_DAYS).toBe("3");
    expect(settings.VAT_RATE).toBe("0");
    expect(settings.RECONNECTION_FEE_ENABLED).toBe("false");
  });
});

describe("setSetting", () => {
  const fakeConn = () => {
    const calls = [];
    return { calls, execute: async (sql, params) => calls.push({ sql, params }) };
  };

  it("upserts, so a company missing the row still gets one", async () => {
    const conn = fakeConn();
    await setSetting(conn, { companyId: COMPANY, key: "DRY_RUN", value: true });
    expect(conn.calls[0].sql).toMatch(/ON DUPLICATE KEY UPDATE/i);
  });

  it("stores values as strings, whatever type came in", async () => {
    const conn = fakeConn();
    await setSetting(conn, { companyId: COMPANY, key: "GRACE_DAYS", value: 0 });
    // `0` must survive as "0" — not become null via a falsy check.
    expect(conn.calls[0].params[2]).toBe("0");
  });

  it("keeps a genuine null as null", async () => {
    const conn = fakeConn();
    await setSetting(conn, { companyId: COMPANY, key: "VAT_RATE", value: null });
    expect(conn.calls[0].params[2]).toBeNull();
  });

  it("records who changed it", async () => {
    const conn = fakeConn();
    await setSetting(conn, {
      companyId: COMPANY,
      key: "DRY_RUN",
      value: "true",
      updatedBy: "acct-1",
    });
    expect(conn.calls[0].params[3]).toBe("acct-1");
  });
});
