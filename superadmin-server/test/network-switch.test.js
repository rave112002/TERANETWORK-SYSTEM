import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readBranchHealth } from "../../shared/manage-contract/index.js";
import { healthWarnings } from "../src/branchClient.js";

/** A healthy branch; `over` changes what a test is about. */
const health = (over = {}) => ({
  manageApiVersion: 1,
  appVersion: "1.0.0",
  serverTime: "2026-09-28 20:00:00",
  uptimeSeconds: 60,
  database: { ok: true, latencyMs: 2 },
  migrations: { applied: 17, pending: 0, latest: null },
  jobs: { queued: 0, failed: 0, dead: 0 },
  installation: { companyName: "TERANETWORK", branchName: "Main", branchCount: 1 },
  dryRun: false,
  backup: { lastBackupAt: "2026-09-28 01:00:00" },
  ...over,
});

describe("the network switch in branch health (D11)", () => {
  it("accepts a branch that reports it, and one too old to", () => {
    assert.equal(readBranchHealth(health({ networkEnabled: false })).ok, true);
    assert.equal(readBranchHealth(health()).ok, true);
  });

  it("refuses a value that is not a boolean", () => {
    assert.deepEqual(readBranchHealth(health({ networkEnabled: "no" })), {
      ok: false,
      problem: 'unexpected "networkEnabled"',
    });
  });

  it("does not warn about dry-run on a billing-only branch", () => {
    assert.deepEqual(healthWarnings(health({ dryRun: true, networkEnabled: false })), []);
    assert.deepEqual(healthWarnings(health({ dryRun: true })), [
      "Dry-run is on: disconnections are simulated, not sent to the OLT",
    ]);
  });
});
