import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { healthWarnings } from "../src/branchClient.js";

/** Email use against the branch's Gmail limit, as SuperAdmin reports it. */
const health = (email) => ({
  database: { ok: true, latencyMs: 2 },
  migrations: { applied: 15, pending: 0, latest: null },
  jobs: { queued: 0, failed: 0, dead: 0 },
  installation: { companyName: "TERANETWORK", branchName: "Main", branchCount: 1 },
  dryRun: false,
  backup: { lastBackupAt: "2026-09-28 01:00:00" },
  ...(email === undefined ? {} : { email }),
});

const usage = (over = {}) => ({
  sentLast24h: 0,
  failedLast24h: 0,
  quotaRefusedLast24h: 0,
  limit: 500,
  configured: true,
  ...over,
});

describe("email usage warnings", () => {
  it("says nothing for normal use, or for a branch too old to report it", () => {
    assert.deepEqual(healthWarnings(health(usage({ sentLast24h: 212 }))), []);
    assert.deepEqual(healthWarnings(health(undefined)), []);
  });

  it("warns from 80% of the limit", () => {
    assert.deepEqual(healthWarnings(health(usage({ sentLast24h: 400 }))), [
      "Email use is high: 400 of 500 in the last 24 hours",
    ]);
  });

  it("says the limit is reached at 100%", () => {
    assert.deepEqual(healthWarnings(health(usage({ sentLast24h: 500 }))), [
      "Email limit reached: 500 of 500 in the last 24 hours",
    ]);
  });

  it("trusts Gmail's refusal over the count", () => {
    // The account may also be used by hand, which the branch cannot see.
    assert.deepEqual(healthWarnings(health(usage({ sentLast24h: 90, quotaRefusedLast24h: 3 }))), [
      "Gmail refused 3 email(s): daily sending limit reached",
    ]);
  });

  it("flags a branch with no SMTP set up", () => {
    assert.deepEqual(healthWarnings(health(usage({ configured: false }))), [
      "Email is not set up: invoices are not being emailed",
    ]);
  });
});
