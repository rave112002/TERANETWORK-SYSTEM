import { catchAsync } from "../../utils/catchAsync.js";
import { systemAuditContext } from "../../utils/audit.js";
import { cleanActor, MANAGE_ACTOR_HEADER } from "../../../../../shared/manage-contract/index.js";

/**
 * Shared by the management API controllers (D10).
 *
 * A branch installation holds exactly one company and one branch (D7), and the
 * management API has no logged-in user, so every controller needs the same two
 * things: which company/branch this is, and how to name SuperAdmin in the audit
 * trail.
 */

export const COMPANY_COLUMNS = "companyId, name, email, phone, website, address, tin, logoUrl";

/** Sets `req.installation = { company, branchId }`, or answers 404 COMPANY_NOT_FOUND. */
export const loadInstallation = catchAsync(async (req, res, next) => {
  const [company] = await req.db.query(
    `SELECT ${COMPANY_COLUMNS} FROM companies
      WHERE status != 'Deleted' ORDER BY dateCreated ASC LIMIT 1`
  );
  if (!company) {
    return res.status(404).json({
      success: false,
      message: "This installation has no company set up yet",
      code: "COMPANY_NOT_FOUND",
    });
  }
  const [branch] = await req.db.query(
    `SELECT branchId FROM branches WHERE companyId = ? AND status != 'Deleted' ORDER BY id LIMIT 1`,
    [company.companyId]
  );
  req.installation = { company, branchId: branch?.branchId ?? null };
  return next();
});

/**
 * The audit context for a change made through the management API:
 * `system:superadmin:<username>`, scoped to this installation.
 */
export const manageAuditContext = (req) => {
  const actor = cleanActor(req.get(MANAGE_ACTOR_HEADER)) || "unknown";
  return {
    ...systemAuditContext(`superadmin:${actor}`, {
      companyId: req.installation.company.companyId,
      branchId: req.installation.branchId,
    }),
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
};

export default { loadInstallation, manageAuditContext, COMPANY_COLUMNS };
