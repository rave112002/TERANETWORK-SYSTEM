import { describe, expect, it, vi } from "vitest";

import { cutoffDate, findDisconnectCandidates, isStillEligibleForDisconnect } from "./dunning.service.js";

/**
 * The sweep decides who loses their internet, so these tests are written as
 * assertions about people rather than about rows.
 */

/** A database double that records the SQL and parameters it was asked for. */
const fakeDb = (rows = []) => {
  const calls = [];
  return {
    calls,
    query: vi.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (/system_settings/i.test(sql)) return [{ settingValue: "3" }];
      return rows;
    }),
  };
};

describe("cutoffDate", () => {
  it("makes an invoice eligible exactly `grace` days after it fell due", () => {
    // Due Aug 7, grace 3 → eligible on Aug 10, not before.
    expect(cutoffDate("2026-08-10", 3)).toBe("2026-08-07");
  });

  it("does not make anybody eligible on the due date itself", () => {
    // On Aug 7 the cutoff is Aug 4, so an invoice due Aug 7 is not selected.
    // Disconnecting on the due date is the single most expensive off-by-one
    // available here.
    const cutoff = cutoffDate("2026-08-07", 3);
    expect(cutoff).toBe("2026-08-04");
    expect(cutoff < "2026-08-07").toBe(true);
  });

  it("treats a grace period of zero as due-date-is-cutoff", () => {
    // 0 is a legitimate setting, and must not be read as "unset, use 3".
    expect(cutoffDate("2026-08-07", 0)).toBe("2026-08-07");
  });

  it("crosses a month boundary correctly", () => {
    expect(cutoffDate("2026-09-02", 3)).toBe("2026-08-30");
  });

  it("crosses a year boundary correctly", () => {
    expect(cutoffDate("2027-01-02", 5)).toBe("2026-12-28");
  });

  it("computes in Manila, not UTC", () => {
    // 2026-08-10 00:30 Manila is still 2026-08-09 in UTC. Getting this wrong
    // disconnects a day early, and only for sweeps run between midnight and
    // 08:00 — which is exactly when a cron runs.
    expect(cutoffDate("2026-08-09T16:30:00Z", 3)).toBe("2026-08-07");
  });
});

describe("findDisconnectCandidates — the reasons not to disconnect somebody", () => {
  const sqlOf = (db) => db.calls.at(-1).sql;

  it("only ever considers unpaid invoices", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, { runDate: "2026-08-10", graceDays: 3 });
    expect(sqlOf(db)).toMatch(/i\.status IN \('issued', 'overdue'\)/);
  });

  it("only considers active subscriptions", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, { runDate: "2026-08-10", graceDays: 3 });
    // Never re-disconnect somebody already suspended, and never touch a
    // terminated account.
    expect(sqlOf(db)).toMatch(/s\.status = 'active'/);
  });

  it("skips subscriptions with no modem attached", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, { runDate: "2026-08-10", graceDays: 3 });
    expect(sqlOf(db)).toMatch(/s\.onuId IS NOT NULL/);
  });

  it("excludes anybody holding a live exemption", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, { runDate: "2026-08-10", graceDays: 3 });
    expect(sqlOf(db)).toMatch(/NOT EXISTS/);
    expect(sqlOf(db)).toMatch(/de\.status = 'Active'/);
    expect(sqlOf(db)).toMatch(/de\.expiresAt > \?/);
  });

  it("ignores a revoked exemption", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, { runDate: "2026-08-10", graceDays: 3 });
    // A revoked exemption must not keep shielding an account, so the subquery
    // filters on status rather than merely on the expiry date.
    expect(sqlOf(db)).toMatch(/de\.status = 'Active'[\s\S]*de\.expiresAt/);
  });

  it("binds the cutoff and the clock in the order the placeholders appear", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, { runDate: "2026-08-10", graceDays: 3 });

    // The trap this pins: MySQL compares a DATE against a DATETIME string
    // without complaining, so swapping these two produces a plausible wrong
    // answer about who to cut off rather than an error.
    const [cutoff, now] = db.calls.at(-1).params;
    expect(cutoff).toBe("2026-08-07");
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("returns one row per subscription, not per unpaid invoice", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, { runDate: "2026-08-10", graceDays: 3 });
    // A customer three months behind loses their service once.
    expect(sqlOf(db)).toMatch(/GROUP BY s\.subscriptionId/);
  });

  it("narrows to one subscription when asked", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, {
      runDate: "2026-08-10",
      graceDays: 3,
      subscriptionId: "sub-1",
    });
    expect(sqlOf(db)).toMatch(/s\.subscriptionId = \?/);
    expect(db.calls.at(-1).params).toContain("sub-1");
  });

  it("selects NOTHING for a user scoped to no branches", async () => {
    const db = fakeDb([{ subscriptionId: "sub-1" }]);
    const rows = await findDisconnectCandidates(db, {
      runDate: "2026-08-10",
      graceDays: 3,
      branchIds: [],
    });

    // Fail closed. Reading an empty scope as "no filter" would let a user with
    // no branch assignments disconnect the entire estate.
    expect(rows).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("scopes to the branches given", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, {
      runDate: "2026-08-10",
      graceDays: 3,
      branchIds: ["b1", "b2"],
    });
    expect(sqlOf(db)).toMatch(/s\.branchId IN \(\?,\?\)/);
    expect(db.calls.at(-1).params).toEqual(expect.arrayContaining(["b1", "b2"]));
  });

  it("puts the oldest debt first", async () => {
    const db = fakeDb();
    await findDisconnectCandidates(db, { runDate: "2026-08-10", graceDays: 3 });
    expect(sqlOf(db)).toMatch(/ORDER BY MIN\(i\.dueDate\) ASC/);
  });
});

describe("isStillEligibleForDisconnect — the worker's last question", () => {
  it("says yes for somebody who has still not paid", async () => {
    const db = fakeDb([{ subscriptionId: "sub-1" }]);
    expect(await isStillEligibleForDisconnect(db, "sub-1")).toBe(true);
  });

  it("says NO once the debt is gone", async () => {
    // The whole point of the function: a payment landed while the job sat in
    // the queue, so the candidate query now returns nothing.
    const db = fakeDb([]);
    expect(await isStillEligibleForDisconnect(db, "sub-1")).toBe(false);
  });

  it("asks about one subscription, not the whole estate", async () => {
    const db = fakeDb([]);
    await isStillEligibleForDisconnect(db, "sub-42");
    const candidateCall = db.calls.find((c) => /FROM subscriptions/.test(c.sql));
    expect(candidateCall.params).toContain("sub-42");
  });

  it("re-uses the sweep's own criteria rather than a copy of them", async () => {
    const db = fakeDb([]);
    await isStillEligibleForDisconnect(db, "sub-1");
    const candidateCall = db.calls.find((c) => /FROM subscriptions/.test(c.sql));

    // If this ever stops matching the sweep's query, somebody can be queued by
    // one rule and disconnected against another.
    expect(candidateCall.sql).toMatch(/i\.status IN \('issued', 'overdue'\)/);
    expect(candidateCall.sql).toMatch(/NOT EXISTS/);
    expect(candidateCall.sql).toMatch(/s\.status = 'active'/);
  });

  it("reads the CURRENT grace period, not the one from when the job was queued", async () => {
    const db = fakeDb([]);
    await isStillEligibleForDisconnect(db, "sub-1");

    // Staff shortening or extending grace between the sweep and the worker
    // should take effect immediately — that is what makes it a setting.
    expect(db.calls.some((c) => /system_settings/i.test(c.sql))).toBe(true);
  });
});

describe("the race, stated as a sequence", () => {
  it("a payment at 20:00:30 stops the 20:01 disconnect", async () => {
    // 20:00:00 — the sweep found this customer and queued a job.
    const atSweep = fakeDb([{ subscriptionId: "sub-1", onuId: "onu-1" }]);
    expect(await isStillEligibleForDisconnect(atSweep, "sub-1")).toBe(true);

    // 20:00:05 — the worker claims the job. It is now 'processing', so the
    // payment path's cancel query cannot reach it.
    // 20:00:30 — the customer pays; the invoice is no longer 'issued'.
    const afterPayment = fakeDb([]);

    // 20:01:00 — the worker asks one last time, immediately before the device
    // call. This is the only thing standing between a paying customer and a
    // disconnection.
    expect(await isStillEligibleForDisconnect(afterPayment, "sub-1")).toBe(false);
  });

  it("a customer who never paid is still disconnected at 20:01", async () => {
    // The guard must not be so cautious that it stops working. Nothing changed
    // between the sweep and the worker, so the disconnection proceeds.
    const db = fakeDb([{ subscriptionId: "sub-2", onuId: "onu-2" }]);
    expect(await isStillEligibleForDisconnect(db, "sub-2")).toBe(true);
  });

  it("an exemption granted while the job waited stops the disconnect", async () => {
    const db = fakeDb([]);
    expect(await isStillEligibleForDisconnect(db, "sub-3")).toBe(false);
  });
});
