import { describe, expect, it } from "vitest";

import {
  MANAGE_API_VERSION,
  readBranchHealth,
  versionCompatibility,
} from "../../../../../shared/manage-contract/index.js";

const valid = {
  manageApiVersion: MANAGE_API_VERSION,
  appVersion: "1.0.0",
  serverTime: "2026-09-17 10:00:00",
  uptimeSeconds: 12,
  installation: { companyName: "TERANETWORK", branchName: "New Lower Bicutan", branchCount: 1 },
  database: { ok: true, latencyMs: 3 },
  migrations: { applied: 15, pending: 0, latest: "015_gcash_statements.sql" },
  jobs: { queued: 0, failed: 0, dead: 0 },
  dryRun: false,
  backup: { lastBackupAt: null },
};

describe("manage contract", () => {
  it("accepts a well-formed health report, including a down database", () => {
    expect(readBranchHealth(valid).ok).toBe(true);
    expect(readBranchHealth({ ...valid, database: { ok: false, latencyMs: null } }).ok).toBe(true);
  });

  it("names the first field that does not match", () => {
    const result = readBranchHealth({ ...valid, jobs: { queued: 0, failed: "2", dead: 0 } });
    expect(result).toEqual({ ok: false, problem: 'unexpected "jobs"' });
    expect(readBranchHealth(null).ok).toBe(false);
  });

  it("classifies versions", () => {
    expect(versionCompatibility(MANAGE_API_VERSION)).toBe("ok");
    expect(versionCompatibility(MANAGE_API_VERSION + 1)).toBe("superadmin_outdated");
    expect(versionCompatibility(0)).toBe("branch_outdated");
    expect(versionCompatibility("1")).toBe("unknown");
  });
});
