import express from "express";
import multer from "multer";

import { catchAsync, validateBody } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { branchScope, getScopedBranchIds } from "../../../utils/branchScope.js";
import { getAuditContext, writeAudit } from "../../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { STATEMENT_CHANNELS } from "../../../lib/payments/reference.js";
import { parseGcashStatement } from "../../../lib/payments/gcash-statement/parser.js";
import {
  readPdfLines,
  StatementPasswordIncorrectError,
  StatementPasswordRequiredError,
  StatementUnreadableError,
} from "../../../lib/payments/gcash-statement/pdfText.js";
import { loadReconciliation } from "../../../lib/payments/gcash-statement/statement.service.js";
import {
  fixReferenceSchema,
  reviewTransactionSchema,
  uploadStatementSchema,
} from "../../../validators/payment-statements.validator.js";

const router = express.Router();

/**
 * GCash Check — staff upload TERANETWORK's GCash transaction-history PDF and
 * see how it compares with the payments they recorded (docs/payments.md).
 *
 * ── The PDF and its password are never kept ─────────────────────────────────
 *
 * Memory storage, not the uploads folder: the file is a personal account's
 * full history and exists here only for the length of the request. The
 * password is a body field named `password`, which the audit middleware
 * already drops. Only the incoming lines survive.
 *
 * ── Nothing here settles an invoice ─────────────────────────────────────────
 *
 * The check reports. A line that is "in the file, not recorded" is recorded
 * the normal way, on the invoice, so it goes through `settleInvoice()` and its
 * reconnection like every other payment.
 *
 * Permission: `billing / payments` — this is the payments screen's own check.
 */

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" && file.originalname.toLowerCase().endsWith(".pdf");
    cb(null, isPdf);
  },
}).single("file");

/** multer as middleware, with its errors answered in the response envelope. */
const receivePdf = (req, res, next) =>
  pdfUpload(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.sendError("The PDF is larger than 10 MB", 400);
    }
    if (err) return res.sendError("The upload could not be read", 400);
    if (!req.file) return res.sendError("Choose the GCash transaction history (a .pdf file)", 400);
    next();
  });

/**
 * GET / — statements uploaded so far, newest period first.
 */
router.get(
  "/",
  checkPermission("billing", "payments", "read"),
  catchAsync(async (req, res) => {
    const scope = branchScope("s.branchId", getScopedBranchIds(req.user));
    const statements = await req.db.query(
      `SELECT s.statementId, s.fileName, s.periodStart, s.periodEnd, s.creditCount,
              s.newCreditCount, s.dateCreated,
              CONCAT(u.firstName, ' ', u.lastName) AS uploadedByName
         FROM gcash_statements s
         LEFT JOIN users u ON u.accountId = s.uploadedBy
        WHERE s.companyId = ?${scope.clause} AND s.status = 'Active'
        ORDER BY s.periodEnd DESC, s.dateCreated DESC`,
      [req.user.companyId, ...scope.params]
    );
    return res.sendSuccess("Statements retrieved", { statements });
  })
);

/**
 * POST / — upload a statement (multipart: `file`, `password`).
 */
router.post(
  "/",
  checkPermission("billing", "payments", "write"),
  receivePdf,
  validateBody(uploadStatementSchema),
  catchAsync(async (req, res) => {
    const { companyId, branchId, accountId } = req.user;

    let lines;
    try {
      lines = await readPdfLines(req.file.buffer, req.body.password);
    } catch (err) {
      if (err instanceof StatementPasswordRequiredError) return res.sendError(err.message, 422);
      if (err instanceof StatementPasswordIncorrectError) {
        return res.sendError("The PDF password is incorrect", 422);
      }
      if (err instanceof StatementUnreadableError) return res.sendError(err.message, 422);
      throw err;
    }

    const parsed = parseGcashStatement(lines);
    if (parsed.transactions.length === 0 || !parsed.periodStart) {
      return res.sendError(
        "No transactions were found in this PDF. Is it a GCash transaction history?",
        422
      );
    }

    // Money in, with a reference to match on. The rest is not a customer payment.
    const credits = parsed.transactions.filter((t) => t.direction === "credit" && t.referenceNo);
    const unique = [...new Map(credits.map((t) => [t.referenceNo, t])).values()];

    let conn;
    let statementId;
    let newCreditCount = 0;
    try {
      conn = await req.db.beginTransaction();
      const now = getCurrentTimestampLocal();

      // The same period uploaded again (a fresh download, a retry) is the same
      // check, not a second entry in the statement list.
      const [samePeriod] = await conn.execute(
        `SELECT statementId FROM gcash_statements
          WHERE companyId = ? AND branchId = ? AND periodStart = ? AND periodEnd = ?
            AND status = 'Active'
          LIMIT 1 FOR UPDATE`,
        [companyId, branchId, parsed.periodStart, parsed.periodEnd]
      );
      if (samePeriod.length) {
        statementId = samePeriod[0].statementId;
        await conn.execute(
          `UPDATE gcash_statements
              SET fileName = ?, creditCount = ?, uploadedBy = ?, dateUpdated = ?
            WHERE statementId = ?`,
          [req.file.originalname.slice(0, 255), unique.length, accountId, now, statementId]
        );
      } else {
        const [uuidRow] = await conn.execute(`SELECT UUID() AS id`);
        statementId = uuidRow[0].id;
        await conn.execute(
          `INSERT INTO gcash_statements
           (statementId, companyId, branchId, fileName, periodStart, periodEnd, creditCount,
            newCreditCount, uploadedBy, status, dateCreated, dateUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'Active', ?, ?)`,
          [
            statementId,
            companyId,
            branchId,
            req.file.originalname.slice(0, 255),
            parsed.periodStart,
            parsed.periodEnd,
            unique.length,
            accountId,
            now,
            now,
          ]
        );
      }

      // Lines already on file from an overlapping upload are left alone, so a
      // "not a customer payment" decision survives the next month's upload.
      const existing = new Map();
      if (unique.length) {
        const [rows] = await conn.execute(
          `SELECT transactionId, referenceNo, status FROM gcash_statement_transactions
            WHERE branchId = ? AND referenceNo IN (${unique.map(() => "?").join(", ")})
            FOR UPDATE`,
          [branchId, ...unique.map((t) => t.referenceNo)]
        );
        rows.forEach((row) => existing.set(row.referenceNo, row));
      }

      for (const t of unique) {
        const found = existing.get(t.referenceNo);
        if (found && found.status === "Active") continue;

        if (found) {
          // Brought back by re-uploading after its statement was removed.
          await conn.execute(
            `UPDATE gcash_statement_transactions
                SET statementId = ?, transactedAt = ?, description = ?, amount = ?,
                    reviewStatus = 'open', reviewedBy = NULL, reviewedAt = NULL,
                    status = 'Active', dateUpdated = ?
              WHERE transactionId = ?`,
            [statementId, t.transactedAt, t.description || null, t.amount, now, found.transactionId]
          );
        } else {
          const [idRow] = await conn.execute(`SELECT UUID() AS id`);
          await conn.execute(
            `INSERT INTO gcash_statement_transactions
               (transactionId, companyId, branchId, statementId, referenceNo, transactedAt,
                description, amount, reviewStatus, status, dateCreated, dateUpdated)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'Active', ?, ?)`,
            [
              idRow[0].id,
              companyId,
              branchId,
              statementId,
              t.referenceNo,
              t.transactedAt,
              t.description || null,
              t.amount,
              now,
              now,
            ]
          );
        }
        newCreditCount++;
      }

      await conn.execute(
        `UPDATE gcash_statements SET newCreditCount = newCreditCount + ?, dateUpdated = ?
          WHERE statementId = ?`,
        [newCreditCount, now, statementId]
      );
      await req.db.commit(conn);
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }

    const result = await loadReconciliation(req.db, {
      companyId,
      branchIds: getScopedBranchIds(req.user),
      statement: parsed,
    });

    return res.sendSuccess(
      "Statement checked",
      {
        statement: {
          statementId,
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
          creditCount: unique.length,
          newCreditCount,
        },
        summary: result.summary,
        warnings: parsed.warnings,
      },
      201
    );
  })
);

/**
 * GET /:statementId/reconciliation — the check, recomputed from current data,
 * so a corrected reference or a newly recorded payment shows immediately.
 */
router.get(
  "/:statementId/reconciliation",
  checkPermission("billing", "payments", "read"),
  catchAsync(async (req, res) => {
    const branchIds = getScopedBranchIds(req.user);
    const scope = branchScope("branchId", branchIds);
    const [statement] = await req.db.query(
      `SELECT statementId, fileName, periodStart, periodEnd, creditCount, newCreditCount, dateCreated
         FROM gcash_statements
        WHERE statementId = ? AND companyId = ?${scope.clause} AND status = 'Active'
        LIMIT 1`,
      [req.params.statementId, req.user.companyId, ...scope.params]
    );
    if (!statement) return res.sendError("Statement not found", 404);

    const result = await loadReconciliation(req.db, {
      companyId: req.user.companyId,
      branchIds,
      statement,
    });
    return res.sendSuccess("Reconciliation retrieved", { statement, ...result });
  })
);

/**
 * DELETE /:statementId — remove an upload (the wrong file, someone else's
 * account). Its lines go with it; lines also in a later upload come back when
 * that one is uploaded again.
 */
router.delete(
  "/:statementId",
  checkPermission("billing", "payments", "write"),
  catchAsync(async (req, res) => {
    const scope = branchScope("branchId", getScopedBranchIds(req.user));
    let conn;
    try {
      conn = await req.db.beginTransaction();
      const now = getCurrentTimestampLocal();
      const [result] = await conn.execute(
        `UPDATE gcash_statements SET status = 'Deleted', dateUpdated = ?
          WHERE statementId = ? AND companyId = ?${scope.clause} AND status = 'Active'`,
        [now, req.params.statementId, req.user.companyId, ...scope.params]
      );
      if (result.affectedRows === 0) {
        await req.db.rollback(conn);
        return res.sendError("Statement not found", 404);
      }
      await conn.execute(
        `UPDATE gcash_statement_transactions SET status = 'Deleted', dateUpdated = ?
          WHERE statementId = ? AND status = 'Active'`,
        [now, req.params.statementId]
      );
      await req.db.commit(conn);
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }
    return res.sendSuccess("Statement removed");
  })
);

/**
 * POST /transactions/:transactionId/review — mark an incoming line as not a
 * customer payment (money from family, a refund), or undo that.
 */
router.post(
  "/transactions/:transactionId/review",
  checkPermission("billing", "payments", "write"),
  validateBody(reviewTransactionSchema),
  catchAsync(async (req, res) => {
    const { reviewStatus } = req.body;
    const scope = branchScope("branchId", getScopedBranchIds(req.user));
    const now = getCurrentTimestampLocal();
    const isOpen = reviewStatus === "open";

    const result = await req.db.query(
      `UPDATE gcash_statement_transactions
          SET reviewStatus = ?, reviewedBy = ?, reviewedAt = ?, dateUpdated = ?
        WHERE transactionId = ? AND companyId = ?${scope.clause} AND status = 'Active'`,
      [
        reviewStatus,
        isOpen ? null : req.user.accountId,
        isOpen ? null : now,
        now,
        req.params.transactionId,
        req.user.companyId,
        ...scope.params,
      ]
    );
    if (!result.affectedRows) return res.sendError("Statement line not found", 404);

    return res.sendSuccess(
      isOpen ? "Moved back to not recorded" : "Marked as not a customer payment"
    );
  })
);

/**
 * POST /fix-reference — a recorded payment's reference was mistyped; replace it
 * with the reference on the statement line it was meant to be.
 *
 * Only the reference changes. The invoice, amount and customer stay as
 * recorded, and the before/after is audited in the same transaction.
 */
router.post(
  "/fix-reference",
  checkPermission("billing", "payments", "write"),
  validateBody(fixReferenceSchema),
  catchAsync(async (req, res) => {
    const { paymentId, transactionId } = req.body;
    const branchIds = getScopedBranchIds(req.user);
    const pScope = branchScope("branchId", branchIds);
    const tScope = branchScope("branchId", branchIds);

    let conn;
    try {
      conn = await req.db.beginTransaction();

      const [payments] = await conn.execute(
        `SELECT paymentId, invoiceId, amount, channel, providerPaymentId FROM payments
          WHERE paymentId = ? AND companyId = ?${pScope.clause}
            AND provider IS NULL AND channel IN (${STATEMENT_CHANNELS.map(() => "?").join(", ")})
          LIMIT 1 FOR UPDATE`,
        [paymentId, req.user.companyId, ...pScope.params, ...STATEMENT_CHANNELS]
      );
      const payment = payments[0];
      const [transactions] = await conn.execute(
        `SELECT transactionId, referenceNo FROM gcash_statement_transactions
          WHERE transactionId = ? AND companyId = ?${tScope.clause} AND status = 'Active'
          LIMIT 1`,
        [transactionId, req.user.companyId, ...tScope.params]
      );
      const transaction = transactions[0];

      if (!payment || !transaction) {
        await req.db.rollback(conn);
        return res.sendError("Payment or statement line not found", 404);
      }
      if (payment.providerPaymentId === transaction.referenceNo) {
        await req.db.rollback(conn);
        return res.sendSuccess("The reference already matches", { paymentId });
      }

      const [taken] = await conn.execute(
        `SELECT paymentId FROM payments WHERE providerPaymentId = ? LIMIT 1 FOR UPDATE`,
        [transaction.referenceNo]
      );
      if (taken.length) {
        await req.db.rollback(conn);
        return res.sendError(
          `Reference ${transaction.referenceNo} is already on another payment`,
          409
        );
      }

      await conn.execute(`UPDATE payments SET providerPaymentId = ? WHERE paymentId = ?`, [
        transaction.referenceNo,
        paymentId,
      ]);
      await writeAudit(conn, {
        context: getAuditContext(req),
        module: "payments",
        action: "fix_reference",
        description: `Corrected payment reference ${payment.providerPaymentId} → ${transaction.referenceNo} from the GCash statement`,
        before: { paymentId, referenceNo: payment.providerPaymentId },
        after: { paymentId, referenceNo: transaction.referenceNo },
        meta: { transactionId },
      });
      await req.db.commit(conn);
    } catch (err) {
      if (conn) await req.db.rollback(conn);
      throw err;
    }

    return res.sendSuccess("Reference corrected", { paymentId });
  })
);

export default router;
