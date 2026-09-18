import express from "express";
import { z } from "zod";

import { catchAsync, validateBody } from "../../../utils/catchAsync.js";
import { writeAudit } from "../../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { hashPassword } from "../../../utils/hashing/argonHash.js";
import { optionalPhone } from "../../../validators/_helpers.js";
import { loadInstallation, manageAuditContext } from "../../../lib/manage/installation.js";
import {
  MANAGED_ROLES,
  MIN_BRANCH_PASSWORD_LENGTH,
} from "../../../../../../shared/manage-contract/index.js";

const router = express.Router();

/**
 * Branch logins, managed from the central SuperAdmin (D10). Mounted at
 * /api/v1/manage/users, behind the management key.
 *
 * SuperAdmin creates the Owner and Admin logins and can recover any login
 * (reset a password, switch it off or on). Day-to-day staff logins (Billing,
 * Technician) stay with the branch's own Admin portal.
 *
 * Every change is audited on this branch as `system:superadmin:<user>`, in the
 * same transaction. Passwords never reach the audit trail or a response.
 */

const password = z
  .string()
  .min(
    MIN_BRANCH_PASSWORD_LENGTH,
    `Password must be at least ${MIN_BRANCH_PASSWORD_LENGTH} characters`
  )
  .max(255);

const createLoginSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  email: z.string().trim().min(1, "Email is required").email("Invalid email address").max(100),
  phone: optionalPhone(),
  role: z.enum(MANAGED_ROLES, { error: `Role must be one of: ${MANAGED_ROLES.join(", ")}` }),
  password,
});

const resetPasswordSchema = z.object({ password });

const statusSchema = z.object({
  status: z.enum(["Active", "Inactive"], { error: "Status must be Active or Inactive" }),
});

const USER_COLUMNS = `u.accountId, u.firstName, u.lastName, u.phone, u.status, u.dateCreated,
  c.email, r.roleName`;

const scope = (req) => [req.installation.company.companyId, req.installation.branchId];

/** Runs `work(conn)` in a transaction and audits it in the same one. */
const inTransaction = async (req, work) => {
  let conn;
  try {
    conn = await req.db.beginTransaction();
    const result = await work(conn, getCurrentTimestampLocal());
    await req.db.commit(conn);
    return result;
  } catch (err) {
    if (conn) await req.db.rollback(conn);
    throw err;
  }
};

/** Signs the login out everywhere it is remembered: every refresh token is revoked. */
const revokeSessions = (conn, accountId, now) =>
  conn.execute(
    `UPDATE refresh_tokens SET revokedAt = ?, dateUpdated = ?
      WHERE accountId = ? AND revokedAt IS NULL`,
    [now, now, accountId]
  );

const findUser = async (conn, req, accountId) => {
  const [rows] = await conn.execute(
    `SELECT ${USER_COLUMNS} FROM users u
       LEFT JOIN credentials c ON c.accountId = u.accountId
       LEFT JOIN roles r ON r.roleId = u.roleId
      WHERE u.accountId = ? AND u.companyId = ? AND u.branchId = ? AND u.status != 'Deleted'
      LIMIT 1 FOR UPDATE`,
    [accountId, ...scope(req)]
  );
  return rows[0] ?? null;
};

router.use(loadInstallation);

/** GET / — every login on this branch, Owner first. */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const users = await req.db.query(
      `SELECT ${USER_COLUMNS} FROM users u
         LEFT JOIN credentials c ON c.accountId = u.accountId
         LEFT JOIN roles r ON r.roleId = u.roleId
        WHERE u.companyId = ? AND u.branchId = ? AND u.status != 'Deleted'
        ORDER BY (r.roleName = 'Owner') DESC, (r.roleName = 'Admin') DESC, u.firstName, u.lastName`,
      scope(req)
    );
    return res.sendSuccess("Branch logins", { users, managedRoles: MANAGED_ROLES });
  })
);

/** POST / — create an Owner or Admin login. One Owner per branch. */
router.post(
  "/",
  validateBody(createLoginSchema),
  catchAsync(async (req, res) => {
    const { firstName, lastName, email, phone, role } = req.body;
    const [companyId, branchId] = scope(req);
    if (!branchId) return res.sendError("This installation has no branch set up yet", 409);

    const hash = await hashPassword(req.body.password);

    const outcome = await inTransaction(req, async (conn, now) => {
      const [roles] = await conn.execute(
        `SELECT roleId FROM roles
          WHERE companyId = ? AND branchId = ? AND roleName = ? AND status = 'Active' LIMIT 1`,
        [companyId, branchId, role]
      );
      if (!roles.length) {
        return {
          error: [409, `This branch has no active ${role} role. Run db:setup on the branch.`],
        };
      }
      const { roleId } = roles[0];

      if (role === "Owner") {
        const [owners] = await conn.execute(
          `SELECT accountId FROM users
            WHERE companyId = ? AND branchId = ? AND roleId = ? AND status != 'Deleted'
            LIMIT 1 FOR UPDATE`,
          [companyId, branchId, roleId]
        );
        if (owners.length) {
          return {
            error: [
              409,
              "This branch already has an Owner. Reset that login instead, or create an Admin.",
            ],
          };
        }
      }

      const [taken] = await conn.execute(
        `SELECT accountId FROM credentials WHERE email = ? AND status != 'Deleted' LIMIT 1 FOR UPDATE`,
        [email]
      );
      if (taken.length) return { error: [409, "A login with this email already exists"] };

      const [idRow] = await conn.execute(`SELECT UUID() AS id`);
      const accountId = idRow[0].id;
      await conn.execute(
        `INSERT INTO users (accountId, companyId, branchId, firstName, lastName, phone, roleId, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [accountId, companyId, branchId, firstName, lastName, phone || null, roleId, now, now]
      );
      // The home branch mirrored into user_branches, or the scope predicate
      // matches nothing and the new login sees none of the branch's data.
      const [ubRow] = await conn.execute(`SELECT UUID() AS id`);
      await conn.execute(
        `INSERT INTO user_branches (userBranchId, accountId, branchId, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, 'Active', ?, ?)`,
        [ubRow[0].id, accountId, branchId, now, now]
      );
      await conn.execute(
        `INSERT INTO credentials (accountId, email, password, type, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, 'ADMIN', 'Active', ?, ?)`,
        [accountId, email, hash, now, now]
      );

      await writeAudit(conn, {
        context: manageAuditContext(req),
        module: "users",
        action: "create_login",
        description: `${role} login created from SuperAdmin for ${email}`,
        after: { accountId, firstName, lastName, email, role },
      });
      return { user: await findUser(conn, req, accountId) };
    });

    if (outcome.error) return res.sendError(outcome.error[1], outcome.error[0]);
    return res.sendSuccess(`${role} login created`, { user: outcome.user }, 201);
  })
);

/** PUT /:accountId/password — set a new password and sign the login out everywhere. */
router.put(
  "/:accountId/password",
  validateBody(resetPasswordSchema),
  catchAsync(async (req, res) => {
    const hash = await hashPassword(req.body.password);

    const outcome = await inTransaction(req, async (conn, now) => {
      const user = await findUser(conn, req, req.params.accountId);
      if (!user) return { error: [404, "Login not found on this branch"] };

      await conn.execute(
        `UPDATE credentials SET password = ?, dateUpdated = ? WHERE accountId = ?`,
        [hash, now, user.accountId]
      );
      await revokeSessions(conn, user.accountId, now);
      await writeAudit(conn, {
        context: manageAuditContext(req),
        module: "users",
        action: "reset_password",
        description: `Password reset from SuperAdmin for ${user.email}`,
        meta: { accountId: user.accountId },
      });
      return { user };
    });

    if (outcome.error) return res.sendError(outcome.error[1], outcome.error[0]);
    return res.sendSuccess("Password reset. The login was signed out everywhere.", {
      user: outcome.user,
    });
  })
);

/** PUT /:accountId/status — switch a login off (Inactive) or back on (Active). */
router.put(
  "/:accountId/status",
  validateBody(statusSchema),
  catchAsync(async (req, res) => {
    const { status } = req.body;

    const outcome = await inTransaction(req, async (conn, now) => {
      const user = await findUser(conn, req, req.params.accountId);
      if (!user) return { error: [404, "Login not found on this branch"] };
      if (user.status === status) return { user };

      // Switching off the last Owner would leave nobody able to run the branch.
      if (status === "Inactive" && user.roleName === "Owner") {
        const [owners] = await conn.execute(
          `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.roleId = u.roleId
            WHERE u.companyId = ? AND u.branchId = ? AND r.roleName = 'Owner' AND u.status = 'Active'`,
          scope(req)
        );
        if (Number(owners[0].n) <= 1) {
          return {
            error: [409, "This is the branch's only active Owner. Reset its password instead."],
          };
        }
      }

      await conn.execute(`UPDATE users SET status = ?, dateUpdated = ? WHERE accountId = ?`, [
        status,
        now,
        user.accountId,
      ]);
      if (status === "Inactive") await revokeSessions(conn, user.accountId, now);
      await writeAudit(conn, {
        context: manageAuditContext(req),
        module: "users",
        action: status === "Inactive" ? "deactivate_login" : "activate_login",
        description: `Login ${status === "Inactive" ? "deactivated" : "reactivated"} from SuperAdmin for ${user.email}`,
        before: { status: user.status },
        after: { status },
        meta: { accountId: user.accountId },
      });
      return { user: { ...user, status } };
    });

    if (outcome.error) return res.sendError(outcome.error[1], outcome.error[0]);
    return res.sendSuccess(status === "Inactive" ? "Login deactivated" : "Login reactivated", {
      user: outcome.user,
    });
  })
);

export default router;
