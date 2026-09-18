import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getCurrentTimestampLocal } from "../../utils/dateUtils.js";
import { getAllSettings } from "../settings/settings.service.js";
import { getQueueStats } from "../jobs/jobs.queue.js";
import { MANAGE_API_VERSION } from "../../../../../shared/manage-contract/index.js";

/**
 * What a branch reports about itself to the central SuperAdmin
 * (shared/manage-contract, `BranchHealth`).
 *
 * Health and management facts only — no customers, no money (D10). Every check
 * is independent: a failing database still returns a report that says so,
 * because "reachable but broken" and "offline" need different fixes.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const BACK_ROOT = path.resolve(here, "../../../..");
const MIGRATIONS_DIR = path.join(BACK_ROOT, "database", "migrations");

let appVersionPromise;
const readAppVersion = () => {
  appVersionPromise ??= fs
    .readFile(path.join(BACK_ROOT, "package.json"), "utf8")
    .then((raw) => JSON.parse(raw).version || "0.0.0")
    .catch(() => "0.0.0");
  return appVersionPromise;
};

const migrationFiles = async () => {
  try {
    return (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return [];
  }
};

/**
 * @param {Object} db the request's Database instance.
 * @returns {Promise<import('../../../../../shared/manage-contract/index.js').BranchHealth>}
 */
export const collectBranchHealth = async (db) => {
  const started = Date.now();
  const dbOk = await db.healthCheck().catch(() => false);
  const latencyMs = dbOk ? Date.now() - started : null;

  const report = {
    manageApiVersion: MANAGE_API_VERSION,
    appVersion: await readAppVersion(),
    serverTime: getCurrentTimestampLocal(),
    uptimeSeconds: Math.round(process.uptime()),
    installation: { companyName: null, branchName: null, branchCount: 0 },
    database: { ok: dbOk, latencyMs },
    migrations: { applied: 0, pending: 0, latest: null },
    jobs: { queued: 0, failed: 0, dead: 0 },
    dryRun: false,
    // Nothing reports backups yet; the backup task will write this.
    backup: { lastBackupAt: null },
  };

  if (!dbOk) return report;

  const [companies, branches, applied, files] = await Promise.all([
    db.query(`SELECT companyId, name FROM companies WHERE status != 'Deleted' ORDER BY id LIMIT 1`),
    db.query(`SELECT name FROM branches WHERE status != 'Deleted' ORDER BY id`),
    db.query(`SELECT name FROM _migrations ORDER BY id`).catch(() => []),
    migrationFiles(),
  ]);

  const company = companies[0];
  report.installation = {
    companyName: company?.name ?? null,
    branchName: branches[0]?.name ?? null,
    branchCount: branches.length,
  };

  const appliedNames = new Set(applied.map((r) => r.name));
  const appliedFiles = files.filter((f) => appliedNames.has(f));
  report.migrations = {
    applied: appliedFiles.length,
    pending: files.length - appliedFiles.length,
    latest: appliedFiles[appliedFiles.length - 1] ?? null,
  };

  if (company) {
    const [queue, settings] = await Promise.all([
      getQueueStats(db, company.companyId),
      getAllSettings(db, company.companyId),
    ]);
    report.jobs = { queued: queue.queued, failed: queue.failed, dead: queue.dead };
    report.dryRun = settings.DRY_RUN === "true";
  }

  return report;
};

export default { collectBranchHealth };
