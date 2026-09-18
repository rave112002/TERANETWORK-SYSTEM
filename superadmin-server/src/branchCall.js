import {
  cleanActor,
  MANAGE_ACTOR_HEADER,
  MANAGE_API_VERSION,
  MANAGE_BASE_PATH,
  MANAGE_KEY_HEADER,
} from "../../shared/manage-contract/index.js";

/**
 * Calling a branch's management API for an action (read or change something),
 * and turning every way it can fail into one plain answer for the page.
 *
 * Health checks have their own, softer client (branchClient.js) because there
 * "offline" is a normal result. Here it is a failure the person has to see.
 */

/** Branch responses mapped to what SuperAdmin tells the person. */
const FAILURES = {
  offline: [502, "BRANCH_OFFLINE", "The branch did not answer. Is its PC on and connected to Tailscale?"],
  key: [502, "BRANCH_KEY_INVALID", "The branch refused SuperAdmin's key. Check the key in Branches."],
  disabled: [502, "BRANCH_NOT_ENABLED", "The management API is not enabled on this branch (no MANAGE_API_KEY)."],
  outdated: [502, "BRANCH_NEEDS_UPDATE", "This branch does not support this yet. Update the branch."],
  broken: [502, "BRANCH_ERROR", "The branch reported an error."],
};

/**
 * @param {{baseUrl: string, apiKey: string}} branch
 * @param {string} path under /api/v1/manage, e.g. "/company-profile"
 * @param {Object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.json]           sent as a JSON body
 * @param {ReadableStream|import('node:stream').Readable} [options.stream]  sent as-is (multipart)
 * @param {Record<string,string>} [options.headers]
 * @param {string} [options.actor]           SuperAdmin username, for the branch's audit trail
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<{ok: true, status: number, response: Response} | {ok: false, status: number, body: object}>}
 */
export const callBranch = async (
  { baseUrl, apiKey },
  path,
  { method = "GET", json, stream, headers = {}, actor, timeoutMs = 15000, fetchImpl = fetch } = {}
) => {
  const init = {
    method,
    headers: {
      [MANAGE_KEY_HEADER]: apiKey,
      "user-agent": `teranetwork-superadmin/${MANAGE_API_VERSION}`,
      accept: "application/json",
      ...(actor ? { [MANAGE_ACTOR_HEADER]: cleanActor(actor) } : {}),
      ...headers,
    },
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers["content-type"] = "application/json";
  } else if (stream) {
    init.body = stream;
    init.duplex = "half";
  }

  let response;
  try {
    response = await fetchImpl(`${baseUrl}${MANAGE_BASE_PATH}${path}`, init);
  } catch {
    return failure("offline");
  }

  if (response.ok) return { ok: true, status: response.status, response };

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: treated below by status.
  }

  if (response.status === 401) return failure("key");
  if (response.status === 503 && body?.code === "MANAGE_DISABLED") return failure("disabled");
  // A 404 the branch explains (no company, no logo) is a real answer; a bare
  // one means the route does not exist on that build.
  if (response.status === 404 && !body?.code) return failure("outdated");
  if (response.status === 404 && body?.message === "API not found") return failure("outdated");
  if ([400, 404, 409, 413, 422].includes(response.status) && body) {
    return {
      ok: false,
      status: response.status,
      body: { success: false, message: body.message, code: body.code, errors: body.errors },
    };
  }
  return failure("broken", body?.message);
};

const failure = (kind, detail) => {
  const [status, code, message] = FAILURES[kind];
  return {
    ok: false,
    status,
    body: { success: false, code, message: detail && kind === "broken" ? `${message} ${detail}` : message },
  };
};

/**
 * Answer the page with a branch call's result: the branch's `data` on success,
 * the translated failure otherwise.
 *
 * @param {import('express').Response} res
 * @param {Awaited<ReturnType<typeof callBranch>>} result
 * @param {string} message
 */
export const sendBranchResult = async (res, result, message) => {
  if (!result.ok) return res.status(result.status).json(result.body);
  const body = await result.response.json();
  return res.status(result.status).json({ success: true, message: body.message || message, data: body.data });
};

export default { callBranch, sendBranchResult };
