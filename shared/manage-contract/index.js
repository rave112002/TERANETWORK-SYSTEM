/**
 * The management API contract: what the central SuperAdmin and a branch
 * server agree on (docs/decisions.md D10).
 *
 * Imported by BOTH sides:
 *   - back/                 serves  /api/v1/manage/*
 *   - superadmin-server/    calls   /api/v1/manage/*
 *
 * Change a shape here and both sides change in the same commit. Dependency-free
 * on purpose, so either app can load it without installing anything.
 *
 * ── Versioning ──────────────────────────────────────────────────────────────
 *
 * Branches are updated one at a time, so SuperAdmin will talk to branches on
 * older builds. Bump MANAGE_API_VERSION when a response loses or renames a
 * field, or an endpoint's meaning changes. Adding a field does not need a bump.
 * SuperAdmin accepts this version and the one before it.
 */

export const MANAGE_API_VERSION = 1;

/** The oldest branch version this SuperAdmin build still understands. */
export const MIN_SUPPORTED_MANAGE_API_VERSION = Math.max(1, MANAGE_API_VERSION - 1);

/** Where the management API lives on a branch server. */
export const MANAGE_BASE_PATH = "/api/v1/manage";

/** The header that carries the branch's key. */
export const MANAGE_KEY_HEADER = "x-manage-key";

/** A key shorter than this is refused by the branch as misconfigured. */
export const MIN_MANAGE_KEY_LENGTH = 32;

/**
 * Who in SuperAdmin made a change, for the branch's audit trail. The key says
 * "SuperAdmin"; this says which person. Letters, digits and `._@-`, at most
 * MAX_ACTOR_LENGTH — the branch records it as `system:superadmin:<actor>`.
 */
export const MANAGE_ACTOR_HEADER = "x-manage-actor";
export const MAX_ACTOR_LENGTH = 30;

/** Normalise an actor name the same way on both sides; "" when unusable. */
export const cleanActor = (value) =>
  String(value ?? "")
    .replace(/[^\w.@-]/g, "")
    .slice(0, MAX_ACTOR_LENGTH);

/** Largest logo a branch accepts, in bytes. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Logins SuperAdmin may create on a branch. Staff logins (Billing, Technician)
 * are made by the branch's own Owner/Admin in the Admin portal.
 */
export const MANAGED_ROLES = ["Owner", "Admin"];

/** Minimum length for a password SuperAdmin sets on a branch login. */
export const MIN_BRANCH_PASSWORD_LENGTH = 10;

/**
 * GET /api/v1/manage/users — `data.users[]`.
 *
 * @typedef {Object} BranchUser
 * @property {string} accountId
 * @property {string} firstName
 * @property {string} lastName
 * @property {string|null} email
 * @property {string|null} phone
 * @property {string|null} roleName
 * @property {"Active"|"Inactive"|"Suspended"} status
 * @property {string} dateCreated
 */

/**
 * How a branch's reported version relates to this build.
 *
 * @param {unknown} version
 * @returns {"ok"|"branch_outdated"|"superadmin_outdated"|"unknown"}
 */
export const versionCompatibility = (version) => {
  if (!Number.isInteger(version)) return "unknown";
  if (version > MANAGE_API_VERSION) return "superadmin_outdated";
  if (version < MIN_SUPPORTED_MANAGE_API_VERSION) return "branch_outdated";
  return "ok";
};

/**
 * GET /api/v1/manage/health — the `data` of the response envelope.
 *
 * @typedef {Object} BranchHealth
 * @property {number} manageApiVersion
 * @property {string} appVersion           the branch server's package version
 * @property {string} serverTime           branch clock, 'YYYY-MM-DD HH:mm:ss' Asia/Manila
 * @property {number} uptimeSeconds
 * @property {{companyName: string|null, branchName: string|null, branchCount: number}} installation
 *           branchCount should be 1; anything else is a misconfigured installation.
 * @property {{ok: boolean, latencyMs: number|null}} database
 * @property {{applied: number, pending: number, latest: string|null}} migrations
 * @property {{queued: number, failed: number, dead: number}} jobs
 * @property {boolean} dryRun               device actions are simulated, not sent to the OLT
 * @property {{lastBackupAt: string|null}} backup  null until backups report in
 */

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const stringOrNull = (v) => v === null || typeof v === "string";

/**
 * Check a health payload's shape before SuperAdmin shows it. A branch on a
 * newer or broken build must show up as "incompatible", not crash the page.
 *
 * @param {unknown} data
 * @returns {{ok: true, health: BranchHealth} | {ok: false, problem: string}}
 */
export const readBranchHealth = (data) => {
  if (!isObject(data)) return { ok: false, problem: "not an object" };
  const d = data;

  const checks = [
    ["manageApiVersion", Number.isInteger(d.manageApiVersion)],
    ["appVersion", typeof d.appVersion === "string"],
    ["serverTime", typeof d.serverTime === "string"],
    ["uptimeSeconds", typeof d.uptimeSeconds === "number"],
    [
      "installation",
      isObject(d.installation) &&
        stringOrNull(d.installation.companyName) &&
        stringOrNull(d.installation.branchName) &&
        isCount(d.installation.branchCount),
    ],
    [
      "database",
      isObject(d.database) &&
        typeof d.database.ok === "boolean" &&
        (d.database.latencyMs === null || typeof d.database.latencyMs === "number"),
    ],
    [
      "migrations",
      isObject(d.migrations) &&
        isCount(d.migrations.applied) &&
        isCount(d.migrations.pending) &&
        stringOrNull(d.migrations.latest),
    ],
    [
      "jobs",
      isObject(d.jobs) && isCount(d.jobs.queued) && isCount(d.jobs.failed) && isCount(d.jobs.dead),
    ],
    ["dryRun", typeof d.dryRun === "boolean"],
    ["backup", isObject(d.backup) && stringOrNull(d.backup.lastBackupAt)],
  ];

  const bad = checks.find(([, valid]) => !valid);
  if (bad) return { ok: false, problem: `unexpected "${bad[0]}"` };
  return { ok: true, health: d };
};

/**
 * GET /api/v1/manage/company-profile — `data.company`.
 * PUT takes the same fields minus `hasLogo`/`logoVersion`; the logo has its own
 * endpoints (PUT/DELETE/GET …/company-profile/logo).
 *
 * @typedef {Object} CompanyProfile
 * @property {string} name
 * @property {string} email
 * @property {string|null} phone     09XX XXXX XXX
 * @property {string|null} website
 * @property {string|null} address
 * @property {string|null} tin
 * @property {boolean} hasLogo
 * @property {string|null} logoVersion  changes whenever the logo does; use it to bust caches
 */

export default {
  MANAGE_API_VERSION,
  MANAGED_ROLES,
  MIN_BRANCH_PASSWORD_LENGTH,
  MANAGE_ACTOR_HEADER,
  MAX_ACTOR_LENGTH,
  MAX_LOGO_BYTES,
  cleanActor,
  MIN_SUPPORTED_MANAGE_API_VERSION,
  MANAGE_BASE_PATH,
  MANAGE_KEY_HEADER,
  MIN_MANAGE_KEY_LENGTH,
  versionCompatibility,
  readBranchHealth,
};
