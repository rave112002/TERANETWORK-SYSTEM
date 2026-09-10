import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../config/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../billing/cycle.service.js", () => ({
  runMonthlyCycle: vi.fn(async () => ({ created: 0, skipped: 0, failed: 0, results: [] })),
}));

vi.mock("../billing/reminders.service.js", () => ({
  runDailyBilling: vi.fn(async () => ({
    overdue: { updated: 0 },
    finals: { queued: 0 },
    reminders: { queued: 0, target: "2026-09-04" },
  })),
}));

vi.mock("../dunning/dunning.service.js", () => ({
  runDunningSweep: vi.fn(async () => ({ queued: 0, deduped: 0, dryRun: false })),
}));

const { runMonthlyCycle } = await import("../billing/cycle.service.js");
const { runDailyBilling } = await import("../billing/reminders.service.js");
const { runDunningSweep } = await import("../dunning/dunning.service.js");
const { tick } = await import("./scheduler.js");

/**
 * The scheduler used to be three cron strings, two of them settable only from
 * `.env`. It is now one hourly tick that asks each company's settings what is
 * due. These tests are about that decision — not about what the three runs then
 * do, which is mocked out.
 */

/** The client's schedule, as stored settings rows. */
const SCHEDULE_ROWS = [
  { settingKey: "STATEMENT_DAY", settingValue: "25" },
  { settingKey: "DUE_DAY", settingValue: "2" },
  { settingKey: "GRACE_DAYS", settingValue: "0" },
  { settingKey: "REMINDER_DAYS_BEFORE", settingValue: "2" },
  { settingKey: "CYCLE_HOUR", settingValue: "9" },
  { settingKey: "DAILY_HOUR", settingValue: "8" },
  { settingKey: "DUNNING_HOUR", settingValue: "20" },
];

/**
 * A fake db that answers the two queries a tick makes: the company list, and
 * that company's settings.
 */
const fakeDb = (companyId, rows = SCHEDULE_ROWS) => ({
  query: async (sql) =>
    /FROM companies/.test(sql) ? [{ companyId, name: `Co ${companyId}` }] : rows,
});

/**
 * Manila-local times. The tick reads the hour in Asia/Manila, so a bare
 * "2026-09-25T09:00:00Z" would be six in the evening and test nothing useful.
 */
const at = (iso) => `${iso}+08:00`;

let seq = 0;
/** A fresh company per test: the once-a-day marker is module state. */
const nextCompany = () => `co-${(seq += 1)}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tick — what is due this hour", () => {
  it("runs nothing at an hour nothing is scheduled for", async () => {
    const result = await tick(fakeDb(nextCompany()), { now: at("2026-09-10T03:00:00") });

    expect(result).toEqual({ cycle: [], daily: [], dunning: [] });
    expect(runMonthlyCycle).not.toHaveBeenCalled();
    expect(runDailyBilling).not.toHaveBeenCalled();
    expect(runDunningSweep).not.toHaveBeenCalled();
  });

  it("runs the daily notices at the configured hour", async () => {
    await tick(fakeDb(nextCompany()), { now: at("2026-09-10T08:00:00") });

    expect(runDailyBilling).toHaveBeenCalledTimes(1);
    expect(runMonthlyCycle).not.toHaveBeenCalled();
    expect(runDunningSweep).not.toHaveBeenCalled();
  });

  it("runs the disconnection sweep at its own hour", async () => {
    await tick(fakeDb(nextCompany()), { now: at("2026-09-10T20:00:00") });

    expect(runDunningSweep).toHaveBeenCalledTimes(1);
  });

  it("bills only on the statement day, at the billing hour", async () => {
    // The 24th at 09:00 is not the statement day; the 25th at 09:00 is.
    await tick(fakeDb(nextCompany()), { now: at("2026-09-24T09:00:00") });
    expect(runMonthlyCycle).not.toHaveBeenCalled();

    await tick(fakeDb(nextCompany()), { now: at("2026-09-25T09:00:00") });
    expect(runMonthlyCycle).toHaveBeenCalledTimes(1);
  });

  it("does not run the same job twice in a day", async () => {
    const db = fakeDb(nextCompany());

    await tick(db, { now: at("2026-09-10T08:00:00") });
    await tick(db, { now: at("2026-09-10T09:00:00") });
    await tick(db, { now: at("2026-09-10T10:00:00") });

    expect(runDailyBilling).toHaveBeenCalledTimes(1);
  });

  it("catches up after downtime rather than skipping the day", async () => {
    // A worker that was down at 08:00 and came back at 14:00 must still send
    // the day's notices. Waiting until tomorrow means the people due today are
    // cut off tonight having heard nothing.
    await tick(fakeDb(nextCompany()), { now: at("2026-09-10T14:00:00") });

    expect(runDailyBilling).toHaveBeenCalledTimes(1);
  });

  it("runs again the next day", async () => {
    const db = fakeDb(nextCompany());

    await tick(db, { now: at("2026-09-10T08:00:00") });
    await tick(db, { now: at("2026-09-11T08:00:00") });

    expect(runDailyBilling).toHaveBeenCalledTimes(2);
  });

  it("honours a schedule an admin has changed, with no restart", async () => {
    // The point of the whole exercise. This company invoices on the 5th and
    // disconnects at 18:00, and the tick reads that from settings rather than
    // from a cron string baked in at boot.
    const db = fakeDb(nextCompany(), [
      { settingKey: "STATEMENT_DAY", settingValue: "5" },
      { settingKey: "DUE_DAY", settingValue: "2" },
      { settingKey: "GRACE_DAYS", settingValue: "0" },
      { settingKey: "CYCLE_HOUR", settingValue: "6" },
      { settingKey: "DAILY_HOUR", settingValue: "7" },
      { settingKey: "DUNNING_HOUR", settingValue: "18" },
    ]);

    await tick(db, { now: at("2026-09-05T06:00:00") });
    expect(runMonthlyCycle).toHaveBeenCalledTimes(1);

    await tick(db, { now: at("2026-09-05T18:00:00") });
    expect(runDunningSweep).toHaveBeenCalledTimes(1);
  });

  it("keeps one company's broken settings from stopping the others", async () => {
    const healthy = nextCompany();
    const db = {
      query: async (sql, params) => {
        if (/FROM companies/.test(sql)) {
          return [
            { companyId: "co-broken", name: "Broken" },
            { companyId: healthy, name: "Fine" },
          ];
        }
        if (params[0] === "co-broken") throw new Error("settings row is unreadable");
        return SCHEDULE_ROWS;
      },
    };

    // The broken company is skipped rather than crashing the tick, and — the
    // part that matters — its failure is not read as "nothing is due" for
    // anybody else.
    await expect(tick(db, { now: at("2026-09-10T08:00:00") })).resolves.toBeTruthy();
    expect(runDailyBilling).toHaveBeenCalledTimes(1);
    expect(runDailyBilling.mock.calls[0][1].companyId).toBe(healthy);
  });

  it("sends the notices before the sweep when both are due at once", async () => {
    // A schedule where both land in the same hour. The warning has to go first;
    // `validateBillingSchedule` refuses this combination on the way in, but the
    // ordering here is what makes it true even if one slipped through.
    const order = [];
    runDailyBilling.mockImplementationOnce(async () => {
      order.push("daily");
      return { overdue: { updated: 0 }, finals: { queued: 0 }, reminders: { queued: 0, target: "" } };
    });
    runDunningSweep.mockImplementationOnce(async () => {
      order.push("dunning");
      return { queued: 0, deduped: 0, dryRun: false };
    });

    const db = fakeDb(nextCompany(), [
      { settingKey: "DAILY_HOUR", settingValue: "20" },
      { settingKey: "DUNNING_HOUR", settingValue: "20" },
    ]);

    await tick(db, { now: at("2026-09-10T20:00:00") });

    expect(order).toEqual(["daily", "dunning"]);
  });
});
