import { describe, expect, it } from "vitest";

import {
  markOverdueAndNotify,
  runDailyBilling,
  sendFinalNotices,
  sendUpcomingDueReminders,
} from "./reminders.service.js";

/**
 * These tests are about WHICH DAY each notice targets, which is the part that
 * went wrong. They deliberately return no invoices: with an empty result the
 * queueing path never runs, so nothing here needs the job queue mocked, and
 * every assertion is about the date arithmetic rather than about plumbing.
 */

/** A fake `req.db` that records every query it is asked to run. */
const recordingDb = () => {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      return [];
    },
  };
};

/** The client's schedule: issued the 25th, due the 2nd, cut off 20:00 that day. */
const CLIENT_SCHEDULE = {
  statementDay: 25,
  dueDay: 2,
  graceDays: 0,
  reminderDaysBefore: 2,
  cycleHour: 9,
  dailyHour: 8,
  dunningHour: 20,
};

/** The date bound into a query, which is always its first parameter here. */
const targetOf = (entry) => entry.params[0];

describe("sendUpcomingDueReminders", () => {
  it("targets the due date, counting back the configured lead time", async () => {
    const db = recordingDb();
    const result = await sendUpcomingDueReminders(db, {
      runDate: "2026-08-31",
      reminderDaysBefore: 2,
    });

    expect(result.target).toBe("2026-09-02");
    expect(targetOf(db.queries[0])).toBe("2026-09-02");
  });

  it("lands on the last day of the month for the client's schedule", async () => {
    // A two-day lead against a due date of the 2nd falls on the last day of the
    // previous month EVERY month — Sep 30, Oct 31, Feb 28. That is exactly the
    // client's "anyone still unpaid past the last day of the month is notified
    // again", and it is a coincidence of their numbers rather than a rule, so
    // it is worth a test rather than a comment.
    for (const [runDate, due] of [
      ["2026-09-30", "2026-10-02"],
      ["2026-10-31", "2026-11-02"],
      ["2027-02-28", "2027-03-02"],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const result = await sendUpcomingDueReminders(recordingDb(), {
        runDate,
        reminderDaysBefore: 2,
      });
      expect(result.target).toBe(due);
    }
  });

  it("stands down entirely when the lead time is zero", async () => {
    // Zero would target the due date, which is the final notice's day. Two
    // emails one morning saying different things about the same bill is worse
    // than one.
    const db = recordingDb();
    const result = await sendUpcomingDueReminders(db, {
      runDate: "2026-09-02",
      reminderDaysBefore: 0,
    });

    expect(result.queued).toBe(0);
    expect(db.queries).toHaveLength(0);
  });

  it("scopes to one company when asked", async () => {
    const db = recordingDb();
    await sendUpcomingDueReminders(db, { runDate: "2026-08-31", companyId: "co-1" });

    expect(db.queries[0].sql).toMatch(/companyId = \?/);
    expect(db.queries[0].params).toEqual(["2026-09-02", "co-1"]);
  });
});

describe("sendFinalNotices — the warning that used to arrive too late", () => {
  it("goes out on the due date itself when there is no grace period", async () => {
    // The bug this exists for: due on the 2nd, cut off at 20:00 on the 2nd, and
    // the only notice sent on the 3rd. The one message that mattered arrived
    // the morning AFTER the disconnection it was warning about.
    const db = recordingDb();
    const result = await sendFinalNotices(db, { runDate: "2026-09-02", graceDays: 0 });

    expect(result.target).toBe("2026-09-02");
  });

  it("moves with the grace period, so it always lands on the cut-off day", async () => {
    // Three days of grace: on Sep 5, the invoices out of grace are the ones due
    // Sep 2. Same arithmetic the dunning sweep uses to pick who to disconnect.
    const result = await sendFinalNotices(recordingDb(), {
      runDate: "2026-09-05",
      graceDays: 3,
    });

    expect(result.target).toBe("2026-09-02");
  });

  it("catches invoices already flipped to overdue", async () => {
    // With any grace period at all, the invoice is marked overdue the morning
    // after its due date — days before its cut-off. Matching only 'issued'
    // would silently send nothing to exactly the people about to be cut off.
    const db = recordingDb();
    await sendFinalNotices(db, { runDate: "2026-09-05", graceDays: 3 });

    expect(db.queries[0].sql).toMatch(/status IN \('issued', 'overdue'\)/);
  });

  it("warns only the people the sweep will actually cut off", async () => {
    // "Your connection will be suspended at 20:00 today" has to be true when it
    // is sent. Somebody already suspended, with no modem, or shielded by a
    // staff exemption is not going to be disconnected tonight, and telling them
    // otherwise is a phone call for whoever granted the exemption.
    const db = recordingDb();
    await sendFinalNotices(db, { runDate: "2026-09-02", graceDays: 0 });

    const { sql } = db.queries[0];
    expect(sql).toMatch(/s\.status = 'active'/);
    expect(sql).toMatch(/s\.onuId IS NOT NULL/);
    expect(sql).toMatch(/NOT EXISTS[\s\S]*dunning_exemptions/);
  });
});

describe("markOverdueAndNotify", () => {
  it("only touches invoices whose due date has actually passed", async () => {
    const db = recordingDb();
    const result = await markOverdueAndNotify(db, { runDate: "2026-09-02" });

    expect(result.today).toBe("2026-09-02");
    // Strictly less than: an invoice due today is due, not late.
    expect(db.queries[0].sql).toMatch(/dueDate < \?/);
  });
});

describe("runDailyBilling", () => {
  it("runs overdue, then the final notice, then the reminder", async () => {
    // The order a customer experiences. Reversed, an invoice that is already
    // past due would get a "due in two days" reminder.
    const db = recordingDb();
    const result = await runDailyBilling(db, {
      runDate: "2026-09-02",
      companyId: "co-1",
      schedule: CLIENT_SCHEDULE,
    });

    expect(db.queries).toHaveLength(3);
    expect(db.queries[0].sql).toMatch(/status = 'issued' AND dueDate < \?/);
    expect(db.queries[1].sql).toMatch(/status IN \('issued', 'overdue'\)/);
    expect(db.queries[2].sql).toMatch(/status = 'issued' AND dueDate = \?/);

    expect(result.overdue.today).toBe("2026-09-02");
    expect(result.finals.target).toBe("2026-09-02");
    expect(result.reminders.target).toBe("2026-09-04");
  });

  it("warns everyone due today before the evening sweep takes them off", async () => {
    // The whole sequencing fix in one assertion: on the due date the final
    // notice targets exactly the invoices the 20:00 dunning sweep will act on,
    // and the daily run happens at 08:00 — twelve hours earlier, an ordering
    // `validateBillingSchedule` refuses to let anyone invert.
    const result = await runDailyBilling(recordingDb(), {
      runDate: "2026-09-02",
      companyId: "co-1",
      schedule: CLIENT_SCHEDULE,
    });

    expect(result.finals.target).toBe("2026-09-02");
    expect(CLIENT_SCHEDULE.dailyHour).toBeLessThan(CLIENT_SCHEDULE.dunningHour);
  });

  it("passes the company through to every query", async () => {
    const db = recordingDb();
    await runDailyBilling(db, {
      runDate: "2026-09-02",
      companyId: "co-1",
      schedule: CLIENT_SCHEDULE,
    });

    for (const entry of db.queries) {
      expect(entry.params).toContain("co-1");
    }
  });
});
