import {
  MANAGE_BASE_PATH,
  MANAGE_KEY_HEADER,
  MIN_SUPPORTED_MANAGE_API_VERSION,
  MANAGE_API_VERSION,
  readBranchHealth,
  versionCompatibility,
} from "../../shared/manage-contract/index.js";

/**
 * Calling one branch's management API.
 *
 * Every outcome becomes a status the page can show, never an exception: one
 * branch being off must not break the list of the others (D10).
 *
 *   online         answered, compatible, database up
 *   degraded       answered and compatible, but its database is down
 *   offline        no answer: PC off, Tailscale down, wrong address, timeout
 *   unauthorized   answered, but the key does not match
 *   not_enabled    answered, but MANAGE_API_KEY is not set on that branch
 *   incompatible   answered, but on a version or shape this build does not understand
 *   error          answered with something else (HTTP 5xx, not JSON…)
 */

const result = (status, message, extra = {}) => ({
  status,
  message,
  checkedAt: new Date().toISOString(),
  ...extra,
});

/** Things worth a person's attention on a branch that is otherwise up. */
export const healthWarnings = (health) => {
  const warnings = [];
  if (!health.database.ok) warnings.push("Database is not responding");
  if (health.migrations.pending > 0) {
    warnings.push(`${health.migrations.pending} database migration(s) not applied`);
  }
  if (health.jobs.dead > 0) warnings.push(`${health.jobs.dead} background job(s) gave up`);
  if (health.jobs.failed > 0) warnings.push(`${health.jobs.failed} background job(s) failing`);
  if (health.installation.branchCount !== 1) {
    warnings.push(
      `This installation has ${health.installation.branchCount} branches; it should have exactly 1`
    );
  }
  if (health.dryRun) warnings.push("Dry-run is on: disconnections are simulated, not sent to the OLT");
  if (!health.backup.lastBackupAt) warnings.push("No backup reported");
  return warnings;
};

/**
 * @param {{baseUrl: string, apiKey: string}} branch
 * @param {{timeoutMs?: number, fetchImpl?: typeof fetch}} [options]
 */
export const checkBranchHealth = async ({ baseUrl, apiKey }, { timeoutMs = 5000, fetchImpl = fetch } = {}) => {
  const started = Date.now();
  let response;
  try {
    response = await fetchImpl(`${baseUrl}${MANAGE_BASE_PATH}/health`, {
      headers: {
        [MANAGE_KEY_HEADER]: apiKey,
        accept: "application/json",
        // The branch server refuses requests with no User-Agent.
        "user-agent": `teranetwork-superadmin/${MANAGE_API_VERSION}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError";
    return result(
      "offline",
      timedOut
        ? `No answer within ${Math.round(timeoutMs / 1000)} seconds`
        : "Could not connect. Is the branch PC on and connected to Tailscale?"
    );
  }

  const latencyMs = Date.now() - started;
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Handled below by status.
  }

  if (response.status === 401) {
    return result("unauthorized", "The key does not match this branch's MANAGE_API_KEY", { latencyMs });
  }
  if (response.status === 503 && body?.code === "MANAGE_DISABLED") {
    return result("not_enabled", "MANAGE_API_KEY is not set on this branch", { latencyMs });
  }
  if (response.status === 404) {
    return result("incompatible", "This branch has no management API. Update it.", { latencyMs });
  }
  if (!response.ok || !body) {
    return result("error", `The branch answered HTTP ${response.status}`, { latencyMs });
  }

  const read = readBranchHealth(body.data);
  if (!read.ok) {
    return result("incompatible", `Unexpected health report (${read.problem})`, { latencyMs });
  }

  const { health } = read;
  const compatibility = versionCompatibility(health.manageApiVersion);
  if (compatibility === "branch_outdated") {
    return result(
      "incompatible",
      `Branch speaks management API v${health.manageApiVersion}; this SuperAdmin needs v${MIN_SUPPORTED_MANAGE_API_VERSION} or newer. Update the branch.`,
      { latencyMs, health }
    );
  }
  if (compatibility === "superadmin_outdated") {
    return result(
      "incompatible",
      `Branch speaks management API v${health.manageApiVersion}; this SuperAdmin only knows up to v${MANAGE_API_VERSION}. Update SuperAdmin.`,
      { latencyMs, health }
    );
  }

  return result(health.database.ok ? "online" : "degraded", health.database.ok ? "Online" : "Online, but its database is down", {
    latencyMs,
    health,
    warnings: healthWarnings(health),
  });
};

export default { checkBranchHealth, healthWarnings };
