import express from "express";

import { catchAsync, validateBody, validateQuery } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import {
  assertBranchInScope,
  branchScope,
  getScopedBranchIds,
} from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { nextAccountNo } from "../../../lib/counters/counters.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersQuerySchema,
} from "../../../validators/customers.validator.js";

const router = express.Router();

/**
 * Subscribers.
 *
 * Branch-scoped: a technician assigned to one branch must not be able to read
 * another branch's subscriber list. Every query goes through `branchScope()` —
 * the one place that decides what a user may see — rather than comparing
 * `branchId` directly. See utils/branchScope.js.
 */

const CUSTOMER_COLUMNS = `c.customerId, c.companyId, c.branchId, c.accountNo, c.name,
  c.email, c.phone, c.address, c.gpsLat, c.gpsLng, c.idType, c.idNumber, c.notes,
  c.status, c.dateCreated, c.dateUpdated`;

/**
 * GET /
 * List subscribers across every branch the user is assigned to.
 */
router.get(
  "/",
  checkPermission("customers", null, "read"),
  validateQuery(listCustomersQuerySchema),
  catchAsync(async (req, res) => {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status,
      branchId,
      sortBy = "dateCreated",
      sortOrder = "DESC",
    } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * pageSize;

    const scope = branchScope("c.branchId", getScopedBranchIds(req.user));
    const params = [companyId, ...scope.params];
    let whereClause = `WHERE c.companyId = ?${scope.clause}`;

    // Narrowing to one branch is a filter on top of the scope, never a way
    // around it — an out-of-scope branchId simply matches nothing.
    if (branchId) {
      whereClause += " AND c.branchId = ?";
      params.push(branchId);
    }

    if (status) {
      whereClause += " AND c.status = ?";
      params.push(status);
    } else {
      whereClause += " AND c.status != 'Deleted'";
    }

    if (search) {
      whereClause += " AND (c.name LIKE ? OR c.email LIKE ? OR c.accountNo LIKE ? OR c.phone LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const allowedSortColumns = ["dateCreated", "dateUpdated", "name", "accountNo"];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "dateCreated";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const [countRows, customers] = await Promise.all([
      req.db.query(`SELECT COUNT(*) as total FROM customers c ${whereClause}`, params),
      req.db.query(
        `SELECT ${CUSTOMER_COLUMNS}, b.name AS branchName
         FROM customers c
         LEFT JOIN branches b ON b.branchId = c.branchId
         ${whereClause}
         ORDER BY c.${safeSortBy} ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, Number(pageSize), Number(offset)]
      ),
    ]);

    const total = countRows[0]?.total || 0;

    return res.sendSuccess("Customers retrieved successfully", {
      customers,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  })
);

/**
 * GET /:customerId
 */
router.get(
  "/:customerId",
  checkPermission("customers", null, "read"),
  catchAsync(async (req, res) => {
    const { customerId } = req.params;
    const { companyId } = req.user;
    const scope = branchScope("c.branchId", getScopedBranchIds(req.user));

    const rows = await req.db.query(
      `SELECT ${CUSTOMER_COLUMNS}, b.name AS branchName
       FROM customers c
       LEFT JOIN branches b ON b.branchId = c.branchId
       WHERE c.customerId = ? AND c.companyId = ?${scope.clause} AND c.status != 'Deleted'
       LIMIT 1`,
      [customerId, companyId, ...scope.params]
    );

    if (rows.length === 0) {
      return res.sendError("Customer not found", 404);
    }

    return res.sendSuccess("Customer retrieved successfully", { customer: rows[0] });
  })
);

/**
 * POST /
 * Create a subscriber.
 *
 * The account number is allocated from `counters` on this same connection, so a
 * rollback takes the number with it and two concurrent creates cannot collide.
 */
router.post(
  "/",
  checkPermission("customers", null, "write"),
  validateBody(createCustomerSchema),
  catchAsync(async (req, res) => {
    const { name, email, phone, address, gpsLat, gpsLng, idType, idNumber, notes, branchId } =
      req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();

    // Default to the creator's home branch; anything explicit must be a branch
    // they are actually assigned to (throws 403 otherwise).
    const targetBranchId = branchId || req.user.branchId;
    assertBranchInScope(req.user, targetBranchId);

    let conn;
    try {
      conn = await req.db.beginTransaction();

      // Email is how invoices reach a subscriber, so a duplicate inside the
      // same company is almost always a mistaken re-entry rather than two real
      // people. Checked and inserted under one lock.
      const [existing] = await conn.execute(
        `SELECT customerId FROM customers
         WHERE email = ? AND companyId = ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [email, companyId]
      );

      if (existing.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("A customer with this email already exists", 409);
      }

      const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
      const customerId = uuidRow[0].id;
      const accountNo = await nextAccountNo(conn, companyId);

      const customer = {
        customerId,
        companyId,
        branchId: targetBranchId,
        accountNo,
        name,
        email,
        phone: phone || null,
        address: address || null,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        idType: idType || null,
        idNumber: idNumber || null,
        notes: notes || null,
        status: "Active",
      };

      await conn.execute(
        `INSERT INTO customers
           (customerId, companyId, branchId, accountNo, name, email, phone, address,
            gpsLat, gpsLng, idType, idNumber, notes, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [
          customer.customerId,
          customer.companyId,
          customer.branchId,
          customer.accountNo,
          customer.name,
          customer.email,
          customer.phone,
          customer.address,
          customer.gpsLat,
          customer.gpsLng,
          customer.idType,
          customer.idNumber,
          customer.notes,
          now,
          now,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "customers",
        action: "create",
        description: `Created subscriber ${accountNo} — ${name}`,
        after: customer,
      });

      await req.db.commit(conn);
      return res.sendSuccess("Customer created successfully", { customerId, accountNo }, 201);
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * PUT /:customerId
 *
 * `accountNo` and `branchId` are deliberately not editable here: the account
 * number is quoted on invoices already sent, and moving a subscriber between
 * branches would strand their ONU, subscription and invoice history in the old
 * one. Both belong to a dedicated transfer flow if the client ever needs it.
 */
router.put(
  "/:customerId",
  checkPermission("customers", null, "write"),
  validateBody(updateCustomerSchema),
  catchAsync(async (req, res) => {
    const { customerId } = req.params;
    const { name, email, phone, address, gpsLat, gpsLng, idType, idNumber, notes, status } =
      req.body;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();
    const scope = branchScope("branchId", getScopedBranchIds(req.user));

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [existingRows] = await conn.execute(
        `SELECT customerId, branchId, accountNo, name, email, phone, address,
                gpsLat, gpsLng, idType, idNumber, notes, status
         FROM customers
         WHERE customerId = ? AND companyId = ?${scope.clause} AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [customerId, companyId, ...scope.params]
      );

      if (existingRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Customer not found", 404);
      }

      const before = existingRows[0];

      const [clash] = await conn.execute(
        `SELECT customerId FROM customers
         WHERE email = ? AND companyId = ? AND customerId != ? AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [email, companyId, customerId]
      );

      if (clash.length > 0) {
        await req.db.rollback(conn);
        return res.sendError("Another customer already uses this email", 409);
      }

      const after = {
        ...before,
        name,
        email,
        phone: phone || null,
        address: address || null,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        idType: idType || null,
        idNumber: idNumber || null,
        notes: notes || null,
        status: status || "Active",
      };

      await conn.execute(
        `UPDATE customers
         SET name = ?, email = ?, phone = ?, address = ?, gpsLat = ?, gpsLng = ?,
             idType = ?, idNumber = ?, notes = ?, status = ?, dateUpdated = ?
         WHERE customerId = ? AND companyId = ? AND status != 'Deleted'`,
        [
          after.name,
          after.email,
          after.phone,
          after.address,
          after.gpsLat,
          after.gpsLng,
          after.idType,
          after.idNumber,
          after.notes,
          after.status,
          now,
          customerId,
          companyId,
        ]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "customers",
        action: "update",
        description: `Updated subscriber ${before.accountNo} — ${after.name}`,
        before,
        after,
      });

      await req.db.commit(conn);
      return res.sendSuccess("Customer updated successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

/**
 * DELETE /:customerId — soft delete.
 *
 * Refused while the subscriber still has a live subscription: a deleted
 * customer with an active ONU is a service nobody is billing for. The guard
 * tolerates `subscriptions` not existing yet (it arrives in S4) and starts
 * enforcing as soon as it does.
 */
router.delete(
  "/:customerId",
  checkPermission("customers", null, "write"),
  catchAsync(async (req, res) => {
    const { customerId } = req.params;
    const { companyId } = req.user;
    const now = getCurrentTimestampLocal();
    const scope = branchScope("branchId", getScopedBranchIds(req.user));

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [existingRows] = await conn.execute(
        `SELECT customerId, accountNo, name, status FROM customers
         WHERE customerId = ? AND companyId = ?${scope.clause} AND status != 'Deleted'
         LIMIT 1 FOR UPDATE`,
        [customerId, companyId, ...scope.params]
      );

      if (existingRows.length === 0) {
        await req.db.rollback(conn);
        return res.sendError("Customer not found", 404);
      }

      const before = existingRows[0];

      const [tableRows] = await conn.execute(
        `SELECT COUNT(*) AS present
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions'`
      );

      if (tableRows[0].present > 0) {
        const [active] = await conn.execute(
          `SELECT COUNT(*) AS total FROM subscriptions
           WHERE customerId = ? AND status != 'terminated'`,
          [customerId]
        );

        if (active[0].total > 0) {
          await req.db.rollback(conn);
          return res.sendError(
            "This customer still has an active subscription. Terminate it first.",
            409
          );
        }
      }

      await conn.execute(
        `UPDATE customers SET status = 'Deleted', dateUpdated = ?
         WHERE customerId = ? AND companyId = ? AND status != 'Deleted'`,
        [now, customerId, companyId]
      );

      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "customers",
        action: "delete",
        description: `Deleted subscriber ${before.accountNo} — ${before.name}`,
        before,
        after: { ...before, status: "Deleted" },
      });

      await req.db.commit(conn);
      return res.sendSuccess("Customer deleted successfully");
    } catch (err) {
      await req.db.rollback(conn);
      throw err;
    }
  })
);

export default router;
