import { describe, expect, it, vi } from "vitest";

import { backoffSeconds, cancel, complete, enqueue, fail } from "./jobs.queue.js";

/**
 * A fake transaction connection. Records statements so a test can assert what
 * would have been sent, and lets each test script the SELECT results.
 */
const fakeConn = (selectResults = []) => {
  const calls = [];
  const queue = [...selectResults];
  return {
    calls,
    execute: async (sql, params = []) => {
      calls.push({ sql, params });
      if (/SELECT UUID\(\)/i.test(sql)) return [[{ id: "job-uuid-1" }], []];
      if (/^\s*SELECT/i.test(sql)) return [queue.shift() ?? [], []];
      return [{ affectedRows: 1 }, []];
    },
  };
};

const JOB = {
  companyId: "co-1",
  branchId: "br-1",
  type: "deactivate",
  payload: { onuId: "onu-1", reason: "dunning" },
};

describe("backoffSeconds", () => {
  it("grows exponentially and then caps", () => {
    // Jitter is up to 30s, so assert the band rather than an exact value.
    const band = (attempts, minutes) => {
      const s = backoffSeconds(attempts);
      expect(s).toBeGreaterThanOrEqual(minutes * 60);
      expect(s).toBeLessThan(minutes * 60 + 30);
    };
    band(1, 1);
    band(2, 2);
    band(3, 4);
    band(4, 8);
    band(5, 16);
    band(9, 16); // capped
  });

  it("adds jitter, so a device coming back does not face a synchronised wave", () => {
    const samples = new Set(Array.from({ length: 40 }, () => backoffSeconds(3)));
    expect(samples.size).toBeGreaterThan(1);
  });

  it("never returns a negative or zero delay", () => {
    for (const attempts of [0, 1, 2, 10]) {
      expect(backoffSeconds(attempts)).toBeGreaterThan(0);
    }
  });
});

describe("enqueue", () => {
  it("inserts a job and returns its id", async () => {
    const conn = fakeConn();
    const result = await enqueue(conn, JOB);
    expect(result).toEqual({ jobId: "job-uuid-1", deduped: false });
    expect(conn.calls.some((c) => /INSERT INTO jobs/i.test(c.sql))).toBe(true);
  });

  it("serialises the payload as JSON", async () => {
    const conn = fakeConn();
    await enqueue(conn, JOB);
    const insert = conn.calls.find((c) => /INSERT INTO jobs/i.test(c.sql));
    expect(JSON.parse(insert.params[4])).toEqual(JOB.payload);
  });

  it("does not check for duplicates when no dedupe key is given", async () => {
    const conn = fakeConn();
    await enqueue(conn, JOB);
    expect(conn.calls.some((c) => /dedupeKey = \?/i.test(c.sql))).toBe(false);
  });

  it("SKIPS an insert when an equivalent job is already live", async () => {
    // The dunning sweep is re-runnable; three unpaid invoices must still mean
    // one disconnect.
    const conn = fakeConn([[{ jobId: "existing-job" }]]);
    const result = await enqueue(conn, { ...JOB, dedupeKey: "deactivate:onu:onu-1" });

    expect(result).toEqual({ jobId: "existing-job", deduped: true });
    expect(conn.calls.some((c) => /INSERT INTO jobs/i.test(c.sql))).toBe(false);
  });

  it("locks the duplicate check, so two sweeps racing cannot both pass it", async () => {
    const conn = fakeConn([[]]);
    await enqueue(conn, { ...JOB, dedupeKey: "deactivate:onu:onu-1" });
    const check = conn.calls.find((c) => /dedupeKey = \?/i.test(c.sql));
    expect(check.sql).toMatch(/FOR UPDATE/i);
  });

  it("only treats queued and processing as live", async () => {
    // A succeeded or cancelled job must not block the next legitimate one.
    const conn = fakeConn([[]]);
    await enqueue(conn, { ...JOB, dedupeKey: "deactivate:onu:onu-1" });
    const check = conn.calls.find((c) => /dedupeKey = \?/i.test(c.sql));
    expect(check.params).toEqual(["deactivate:onu:onu-1", "queued", "processing"]);
  });

  it("inserts a job when the key exists but nothing is live", async () => {
    const conn = fakeConn([[]]);
    const result = await enqueue(conn, { ...JOB, dedupeKey: "deactivate:onu:onu-1" });
    expect(result.deduped).toBe(false);
    expect(conn.calls.some((c) => /INSERT INTO jobs/i.test(c.sql))).toBe(true);
  });
});

describe("fail — retry, then park", () => {
  const fakeDb = (job) => {
    const calls = [];
    return {
      calls,
      query: async (sql, params = []) => {
        calls.push({ sql, params });
        if (/^\s*SELECT/i.test(sql)) return job ? [job] : [];
        return { affectedRows: 1 };
      },
    };
  };

  it("requeues with backoff while attempts remain", async () => {
    const db = fakeDb({ attempts: 2, maxAttempts: 5 });
    const outcome = await fail(db, "job-1", new Error("OLT unreachable"));

    expect(outcome.status).toBe("queued");
    expect(outcome.attempts).toBe(2);
    expect(outcome.retryInSeconds).toBeGreaterThan(0);

    const update = db.calls.find((c) => /UPDATE jobs/i.test(c.sql));
    expect(update.sql).toMatch(/status = 'queued'/);
    expect(update.sql).toMatch(/nextRunAt = \?/);
  });

  it("DEAD-LETTERS once attempts are exhausted, rather than retrying forever", async () => {
    const db = fakeDb({ attempts: 5, maxAttempts: 5 });
    const outcome = await fail(db, "job-1", new Error("OLT unreachable"));

    expect(outcome.status).toBe("dead");
    expect(outcome.retryInSeconds).toBeNull();
    expect(db.calls.find((c) => /UPDATE jobs/i.test(c.sql)).sql).toMatch(/status = 'dead'/);
  });

  it("releases the lock either way, so a dead job is not left held", async () => {
    for (const job of [{ attempts: 1, maxAttempts: 5 }, { attempts: 5, maxAttempts: 5 }]) {
      const db = fakeDb(job);
      await fail(db, "job-1", new Error("nope"));
      const update = db.calls.find((c) => /UPDATE jobs/i.test(c.sql));
      expect(update.sql).toMatch(/lockedAt = NULL/);
      expect(update.sql).toMatch(/lockedBy = NULL/);
    }
  });

  it("records the error message, truncated", async () => {
    const db = fakeDb({ attempts: 1, maxAttempts: 5 });
    await fail(db, "job-1", new Error("x".repeat(5000)));
    const update = db.calls.find((c) => /UPDATE jobs/i.test(c.sql));
    expect(update.params[0].length).toBe(2000);
  });

  it("survives being given something that is not an Error", async () => {
    const db = fakeDb({ attempts: 1, maxAttempts: 5 });
    await expect(fail(db, "job-1", "just a string")).resolves.toBeTruthy();
    await expect(fail(db, "job-1", undefined)).resolves.toBeTruthy();
  });

  it("does nothing for a job that no longer exists", async () => {
    const db = fakeDb(null);
    const outcome = await fail(db, "missing", new Error("nope"));
    expect(outcome.status).toBe("dead");
    expect(db.calls.some((c) => /UPDATE jobs/i.test(c.sql))).toBe(false);
  });
});

describe("complete", () => {
  it("only completes a job that is actually processing", async () => {
    // Guards against a stale worker marking a job it no longer holds.
    const db = { query: vi.fn(async () => ({ affectedRows: 1 })) };
    await complete(db, "job-1");
    expect(db.query.mock.calls[0][0]).toMatch(/status = 'processing'/);
  });

  it("stores a result when one is given", async () => {
    const db = { query: vi.fn(async () => ({ affectedRows: 1 })) };
    await complete(db, "job-1", { rxDbm: -18.4 });
    expect(db.query.mock.calls[0][0]).toMatch(/JSON_SET/);
  });

  it("leaves the payload alone when there is no result", async () => {
    const db = { query: vi.fn(async () => ({ affectedRows: 1 })) };
    await complete(db, "job-1");
    expect(db.query.mock.calls[0][0]).not.toMatch(/JSON_SET/);
  });
});

describe("cancel — how a payment stops a pending disconnect", () => {
  it("cancels only queued jobs", async () => {
    const conn = fakeConn();
    await cancel(conn, "deactivate:onu:onu-1", "payment received");

    const update = conn.calls.find((c) => /UPDATE jobs/i.test(c.sql));
    expect(update.sql).toMatch(/status = 'cancelled'/);
    // Not 'processing': a worker mid-command cannot be interrupted safely, so
    // the processor's own precondition re-check is the backstop there.
    expect(update.sql).toMatch(/AND status = 'queued'/);
    expect(update.sql).not.toMatch(/'processing'/);
  });

  it("returns how many were cancelled", async () => {
    const conn = fakeConn();
    expect(await cancel(conn, "deactivate:onu:onu-1")).toBe(1);
  });

  it("keeps the reason, so the row explains itself later", async () => {
    const conn = fakeConn();
    await cancel(conn, "deactivate:onu:onu-1", "payment received");
    expect(conn.calls[0].params[0]).toBe("payment received");
  });
});

describe("the dedupe key contract", () => {
  it("is the SAME string the sweep enqueues and a payment cancels", async () => {
    // If these ever diverged, a payment would fail to stop the disconnect it
    // had just paid for. Asserting they are built identically is the guard.
    const key = (onuId) => `deactivate:onu:${onuId}`;

    const enqueueConn = fakeConn([[]]);
    await enqueue(enqueueConn, { ...JOB, dedupeKey: key("onu-1") });
    const inserted = enqueueConn.calls.find((c) => /INSERT INTO jobs/i.test(c.sql)).params[7];

    const cancelConn = fakeConn();
    await cancel(cancelConn, key("onu-1"));
    const cancelled = cancelConn.calls[0].params[3];

    expect(inserted).toBe(cancelled);
  });
});
