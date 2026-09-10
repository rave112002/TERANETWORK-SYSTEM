import { describe, expect, it } from "vitest";

import {
  findAwaitingPullOut,
  findRecoveryCandidates,
  recoveryCutoff,
} from "./recovery.service.js";

/**
 * Recovery decides whether a van goes to somebody's house to take their modem
 * away. Every test here is about the conditions that put a name on that list.
 *
 * The fake returns no rows, so nothing runs past the query — which is the
 * point: the assertions are about which people the query asks for.
 */
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

describe("recoveryCutoff", () => {
  it("counts back from the run date", () => {
    // Suspended on or before Jul 12 means 60 days without service by Sep 10.
    expect(recoveryCutoff("2026-09-10", 60)).toBe("2026-07-12 00:00:00");
  });

  it("counts from the disconnection, not the due date or the last payment", () => {
    // A one-day setting makes the arithmetic unambiguous: yesterday, not today.
    expect(recoveryCutoff("2026-09-10", 1)).toBe("2026-09-09 00:00:00");
  });

  it("crosses a month and a year boundary correctly", () => {
    expect(recoveryCutoff("2027-01-05", 60)).toBe("2026-11-06 00:00:00");
  });
});

describe("findRecoveryCandidates", () => {
  it("asks only for accounts that are still suspended", async () => {
    const db = recordingDb();
    await findRecoveryCandidates(db, { runDate: "2026-09-10", recoveryAfterDays: 60 });

    const { sql } = db.queries[0];
    // Not 'for_recovery' (already decided), not 'terminated' (already gone),
    // and certainly not 'active' — somebody with working service is not a
    // candidate for having their modem taken away.
    expect(sql).toMatch(/s\.status = 'suspended'/);
    expect(sql).toMatch(/s\.recordStatus != 'Deleted'/);
  });

  it("ignores a suspension with no timestamp rather than guessing at one", async () => {
    // A NULL suspendedAt means the clock never started. Treating that as
    // "suspended forever ago" would put a modem on a pull-out list on the
    // strength of a missing value.
    const db = recordingDb();
    await findRecoveryCandidates(db, { runDate: "2026-09-10" });

    expect(db.queries[0].sql).toMatch(/s\.suspendedAt IS NOT NULL/);
  });

  it("binds the cut-off date it computed", async () => {
    const db = recordingDb();
    const result = await findRecoveryCandidates(db, {
      runDate: "2026-09-10",
      recoveryAfterDays: 60,
    });

    expect(result.cutoff).toBe("2026-07-12 00:00:00");
    // First parameter is the run date for DATEDIFF, second the cut-off. Bound
    // in the order the placeholders appear — a mismatch here is silent, since
    // the query still runs and still returns people.
    expect(db.queries[0].params[0]).toBe("2026-09-10");
    expect(db.queries[0].params[1]).toBe("2026-07-12 00:00:00");
  });

  it("still lists somebody holding a dunning exemption", async () => {
    // An exemption shields a customer from being CUT OFF. It says nothing about
    // a modem that has already sat idle for two months, and hiding those
    // accounts would let a shield granted last March quietly cost a modem.
    // The exemption is reported on the row instead, for the person deciding.
    const db = recordingDb();
    await findRecoveryCandidates(db, { runDate: "2026-09-10" });

    const { sql } = db.queries[0];
    expect(sql).toMatch(/exemptionUntil/);
    expect(sql).not.toMatch(/NOT EXISTS[\s\S]*dunning_exemptions/);
  });

  it("returns nothing for a user with no branches", async () => {
    // Fail closed. Getting this backwards would put the whole estate on a
    // pull-out list for somebody who should see none of it.
    const db = recordingDb();
    const result = await findRecoveryCandidates(db, { branchIds: [] });

    expect(result.candidates).toEqual([]);
    expect(db.queries).toHaveLength(0);
  });

  it("scopes to the branches a user does have", async () => {
    const db = recordingDb();
    await findRecoveryCandidates(db, { runDate: "2026-09-10", branchIds: ["br-1", "br-2"] });

    expect(db.queries[0].sql).toMatch(/s\.branchId IN \(\?, \?\)/);
    expect(db.queries[0].params).toContain("br-1");
    expect(db.queries[0].params).toContain("br-2");
  });

  it("reports what is owed, so nobody is written off over a small balance", async () => {
    const db = recordingDb();
    await findRecoveryCandidates(db, { runDate: "2026-09-10" });

    const { sql } = db.queries[0];
    expect(sql).toMatch(/amountOwed/);
    expect(sql).toMatch(/daysSuspended/);
  });
});

describe("findAwaitingPullOut", () => {
  it("lists only accounts already marked for pull-out", async () => {
    const db = recordingDb();
    await findAwaitingPullOut(db, { runDate: "2026-09-10" });

    expect(db.queries[0].sql).toMatch(/s\.status = 'for_recovery'/);
  });

  it("puts the oldest job first", async () => {
    // A pull-out nobody has done in three weeks is the one worth asking about.
    const db = recordingDb();
    await findAwaitingPullOut(db, { runDate: "2026-09-10" });

    expect(db.queries[0].sql).toMatch(/ORDER BY s\.forRecoveryAt ASC/);
  });

  it("carries the address and the NAP port the technician needs", async () => {
    const db = recordingDb();
    await findAwaitingPullOut(db, { runDate: "2026-09-10" });

    const { sql } = db.queries[0];
    expect(sql).toMatch(/customerAddress/);
    expect(sql).toMatch(/napLabel/);
    expect(sql).toMatch(/onuMac/);
  });

  it("returns nothing for a user with no branches", async () => {
    const db = recordingDb();
    expect(await findAwaitingPullOut(db, { branchIds: [] })).toEqual([]);
    expect(db.queries).toHaveLength(0);
  });
});
