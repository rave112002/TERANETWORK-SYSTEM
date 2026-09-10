import { describe, expect, it } from "vitest";

import {
  SETTING_KEYS,
  getAllSettings,
  getBillingSchedule,
  getGraceDays,
  getSetting,
  getVatRate,
  isDryRun,
  isReconnectionFeeEnabled,
  parseBoolean,
  parseIntSetting,
  setSetting,
  validateBillingSchedule,
} from "./settings.service.js";

/** Fake `req.db` returning whatever settings a test wants. */
const fakeDb = (rows) => ({
  query: async () => rows,
});

const withValue = (value) => fakeDb([{ settingValue: value }]);
const missing = fakeDb([]);

/** A fake whose `getAllSettings` shape is right, for the schedule reader. */
const withSettings = (settings) =>
  fakeDb(Object.entries(settings).map(([settingKey, settingValue]) => ({ settingKey, settingValue })));

const COMPANY = "co-1";

/** The client's actual schedule, as migration 011 seeds it. */
const CLIENT_SCHEDULE = {
  statementDay: 25,
  dueDay: 2,
  graceDays: 0,
  reminderDaysBefore: 2,
  cycleHour: 9,
  dailyHour: 8,
  dunningHour: 20,
};

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

describe("parseIntSetting — the `0 || fallback` bug", () => {
  it("TREATS ZERO AS ZERO, even where the default is not zero", () => {
    // The whole point, and the reason this is tested against keys whose default
    // is non-zero: `parseInt("0") || 2` is 2. That bug silently gave every
    // customer extra days of grace, made the dunning sweep look broken, and
    // logged nothing anywhere.
    expect(parseIntSetting("0", SETTING_KEYS.REMINDER_DAYS_BEFORE)).toBe(0);
    // Midnight, not eight in the evening.
    expect(parseIntSetting("0", SETTING_KEYS.DUNNING_HOUR)).toBe(0);
    expect(parseIntSetting("0", SETTING_KEYS.GRACE_DAYS)).toBe(0);
  });

  it("reads ordinary values", () => {
    expect(parseIntSetting("25", SETTING_KEYS.STATEMENT_DAY)).toBe(25);
    expect(parseIntSetting(" 14 ", SETTING_KEYS.GRACE_DAYS)).toBe(14);
  });

  it("falls back on junk rather than guessing", () => {
    for (const junk of ["", "abc", "null", "  ", null, undefined]) {
      expect(parseIntSetting(junk, SETTING_KEYS.STATEMENT_DAY)).toBe(25);
    }
  });

  it("falls back rather than clamping an out-of-range value", () => {
    // Clamping a typed 300 to 28 would run a schedule nobody chose and look
    // deliberate on the screen afterwards.
    expect(parseIntSetting("300", SETTING_KEYS.STATEMENT_DAY)).toBe(25);
    expect(parseIntSetting("-1", SETTING_KEYS.GRACE_DAYS)).toBe(0);
    expect(parseIntSetting("99", SETTING_KEYS.DUNNING_HOUR)).toBe(20);
  });

  it("refuses a day of the month that February does not have", () => {
    // 29, 30 and 31 would silently become "the 28th, except in February" and
    // move the schedule once a year.
    expect(parseIntSetting("31", SETTING_KEYS.DUE_DAY)).toBe(2);
    expect(parseIntSetting("28", SETTING_KEYS.DUE_DAY)).toBe(28);
  });
});

describe("getGraceDays", () => {
  it("reads a configured zero", async () => {
    expect(await getGraceDays(withValue("0"), COMPANY)).toBe(0);
  });

  it("reads ordinary values", async () => {
    expect(await getGraceDays(withValue("3"), COMPANY)).toBe(3);
    expect(await getGraceDays(withValue("14"), COMPANY)).toBe(14);
  });

  it("falls back to the seeded value, not to some other number", async () => {
    // The fallback agrees with what migration 011 writes. An earlier version
    // fell back to 3 while the database held 0, so a missing row behaved
    // differently from a present one and nothing said so.
    for (const junk of ["", "abc", "null", "  "]) {
      expect(await getGraceDays(withValue(junk), COMPANY)).toBe(0);
    }
    expect(await getGraceDays(missing, COMPANY)).toBe(0);
  });

  it("tolerates a value stored with whitespace", async () => {
    expect(await getGraceDays(withValue(" 0 "), COMPANY)).toBe(0);
  });
});

describe("getBillingSchedule", () => {
  it("returns the client's schedule from seeded rows", async () => {
    const db = withSettings({
      STATEMENT_DAY: "25",
      DUE_DAY: "2",
      GRACE_DAYS: "0",
      REMINDER_DAYS_BEFORE: "2",
      CYCLE_HOUR: "9",
      DAILY_HOUR: "8",
      DUNNING_HOUR: "20",
    });

    expect(await getBillingSchedule(db, COMPANY)).toEqual(CLIENT_SCHEDULE);
  });

  it("fills in defaults for a company with no rows at all", async () => {
    expect(await getBillingSchedule(missing, COMPANY)).toEqual(CLIENT_SCHEDULE);
  });

  it("takes one round trip, not one per setting", async () => {
    let queries = 0;
    const db = { query: async () => { queries += 1; return []; } };
    await getBillingSchedule(db, COMPANY);
    expect(queries).toBe(1);
  });
});

describe("validateBillingSchedule", () => {
  it("allows the client's schedule", () => {
    expect(validateBillingSchedule(CLIENT_SCHEDULE)).toBeNull();
  });

  it("refuses a statement day before the previous month's cut-off", () => {
    // Issuing on the 1st with a due day of the 2nd generates the invoice the
    // day BEFORE the disconnection it should have been skipped by, so every
    // reconnected customer owes a month they had no service for.
    const problem = validateBillingSchedule({ ...CLIENT_SCHEDULE, statementDay: 1 });

    expect(problem).toMatch(/issued on day 1/);
    expect(problem).toMatch(/day 2/);
  });

  it("refuses a statement day that lands exactly on the cut-off", () => {
    // Same day is a coin toss decided by which hour each job is set to. The
    // schedule should not depend on that.
    expect(validateBillingSchedule({ ...CLIENT_SCHEDULE, statementDay: 2 })).not.toBeNull();
  });

  it("says so plainly when no statement day could work", () => {
    // 2 + 30 is day 32, which does not exist. Telling someone to "move the
    // statement day later than day 32" is arithmetically consistent and
    // useless — the grace period is the thing that has to change.
    const problem = validateBillingSchedule({ ...CLIENT_SCHEDULE, graceDays: 30 });

    expect(problem).toMatch(/past the end of the month/);
    expect(problem).not.toMatch(/day 32/);
    // 28 - 2: the longest grace period this due date can carry.
    expect(problem).toMatch(/at most 26 days/);
  });

  it("counts grace days as part of the cut-off", () => {
    const withGrace = { ...CLIENT_SCHEDULE, graceDays: 3 };

    // Due the 2nd + 3 days grace = cut off on the 5th.
    expect(validateBillingSchedule({ ...withGrace, statementDay: 5 })).not.toBeNull();
    expect(validateBillingSchedule({ ...withGrace, statementDay: 6 })).toBeNull();
  });

  it("refuses a daily run that would notify people after cutting them off", () => {
    const problem = validateBillingSchedule({
      ...CLIENT_SCHEDULE,
      dailyHour: 21,
      dunningHour: 20,
    });

    expect(problem).toMatch(/21:00/);
    expect(problem).toMatch(/20:00/);
  });

  it("refuses the two runs sharing an hour", () => {
    expect(
      validateBillingSchedule({ ...CLIENT_SCHEDULE, dailyHour: 20, dunningHour: 20 })
    ).not.toBeNull();
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
    expect(await getSetting(fakeDb([{ settingValue: null }]), COMPANY, "STATEMENT_DAY")).toBe("25");
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
    expect(settings.GRACE_DAYS).toBe("0");
    expect(settings.VAT_RATE).toBe("0");
    expect(settings.RECONNECTION_FEE_ENABLED).toBe("false");
    expect(settings.STATEMENT_DAY).toBe("25");
    expect(settings.DUE_DAY).toBe("2");
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
