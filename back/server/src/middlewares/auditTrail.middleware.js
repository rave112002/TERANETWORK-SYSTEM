import { getCurrentTimestampLocal } from "../utils/dateUtils.js";

/**
 * Audit Trail Middleware
 *
 * Automatically logs POST, PUT, DELETE actions to the audit_trail table.
 * Attach AFTER passport auth (requires req.user) and AFTER the route handler responds.
 *
 * Usage:
 *   router.use("/users", requireAuth, auditTrail("users"), usersController);
 *
 * Or for the whole admin portal:
 *   router.use(auditTrail());
 */

// Map HTTP methods to action verbs
const METHOD_ACTION_MAP = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

/**
 * Create audit trail middleware
 * @param {string} [moduleName] - Optional module name override. If not provided, inferred from URL.
 */
export const auditTrail = (moduleName) => {
  return (req, res, next) => {
    // Only log state-changing methods
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    // Capture the original res.json to intercept after response is sent
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const action = METHOD_ACTION_MAP[req.method] || req.method;
        const module = moduleName || inferModule(req.originalUrl);

        // Fire and forget — don't block the response
        logAudit(req, {
          action,
          module,
          description: buildDescription(action, module, req),
          metadata: buildMetadata(req, body),
        }).catch((err) => {
          console.error("Audit trail logging failed:", err.message);
        });
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * Infer module name from the request URL
 * /api/v1/admin/users/123 → "users"
 * /api/v1/admin/roles/456/permissions → "roles"
 */
function inferModule(url) {
  // Remove /api/v1/admin/ or /api/v1/superadmin/ prefix
  const cleaned = url.replace(/^\/api\/v1\/(admin|superadmin)\//, "").split("?")[0]; // Remove query string

  // Get first path segment as module
  const firstSegment = cleaned.split("/")[0];
  return firstSegment || "unknown";
}

/**
 * Build a human-readable description
 */
function buildDescription(action, module, req) {
  const entityId =
    req.params?.userId || req.params?.roleId || req.params?.companyId || req.params?.branchId || null;

  if (entityId) {
    return `${action} ${module} (${entityId})`;
  }

  return `${action} ${module}`;
}

/**
 * Build metadata (sanitized — no passwords or sensitive data)
 */
function buildMetadata(req, responseBody) {
  const metadata = {};

  // Include safe request body fields (exclude sensitive data)
  if (req.body && typeof req.body === "object") {
    const sensitiveFields = [
      "password",
      "salt",
      "token",
      "refreshToken",
      "secret",
      "newPassword",
      "oldPassword",
    ];
    const safeBody = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (!sensitiveFields.includes(key)) {
        safeBody[key] = value;
      }
    }

    if (Object.keys(safeBody).length > 0) {
      metadata.body = safeBody;
    }
  }

  // Include route params
  if (req.params && Object.keys(req.params).length > 0) {
    metadata.params = req.params;
  }

  // Include response data ID if available
  if (responseBody?.data) {
    const { accountId, companyId, branchId, roleId } = responseBody.data;
    const ids = { accountId, companyId, branchId, roleId };
    const filtered = Object.fromEntries(Object.entries(ids).filter(([, v]) => v));
    if (Object.keys(filtered).length > 0) {
      metadata.createdIds = filtered;
    }
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

/**
 * Insert audit log into the database
 */
async function logAudit(req, { action, module, description, metadata }) {
  const now = getCurrentTimestampLocal();
  const { accountId, companyId, branchId } = req.user;

  // Generate UUID
  const uuidResult = await req.db.query(`SELECT UUID() as id`);
  const auditId = uuidResult[0].id;

  await req.db.query(
    `INSERT INTO audit_trail (auditId, companyId, branchId, accountId, action, module, description, metadata, ipAddress, userAgent, dateCreated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      auditId,
      companyId || null,
      branchId || null,
      accountId,
      action,
      module,
      description || null,
      metadata || null,
      req.ip || null,
      req.get("user-agent") || null,
      now,
    ]
  );
}

export default auditTrail;
