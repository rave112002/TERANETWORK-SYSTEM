import express from "express";
import moment from "moment-timezone";

import { catchAsync, validateQuery } from "../../../utils/catchAsync.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import { getScopedBranchIds } from "../../../utils/branchScope.js";
import { sendCsv, toCsv } from "../../../utils/csv.js";
import {
  agingReport,
  collectionsReport,
  operationsSummary,
  subscriberReport,
} from "../../../lib/reports/reports.service.js";
import {
  agingQuerySchema,
  collectionsQuerySchema,
  subscribersQuerySchema,
} from "../../../validators/reports.validator.js";

const router = express.Router();

const TZ = process.env.TIMEZONE || "Asia/Manila";

/**
 * Reports.
 *
 * ── One query behind both the screen and the file ───────────────────────────
 *
 * `?format=csv` on any of these returns the same rows the page shows, as a
 * download. That is deliberate and worth protecting: a report whose export
 * disagrees with the page it came from is worse than no export, because
 * somebody reconciles a bank statement against it and only finds out months
 * later.
 *
 * ── Read-only, and gated on the module being reported ───────────────────────
 *
 * Aging and collections are money, so they need `billing/invoices` read.
 * The subscriber roster needs `subscriptions` read. A technician who can see
 * modems has no business exporting the customer list with what everyone owes.
 */

/** Stamp filenames so two exports of the same report do not overwrite. */
const stamp = () => moment().tz(TZ).format("YYYYMMDD-HHmmss");

/**
 * GET /aging — who owes what, and for how long.
 */
router.get(
  "/aging",
  checkPermission("billing", "invoices", "read"),
  validateQuery(agingQuerySchema),
  catchAsync(async (req, res) => {
    const report = await agingReport(req.db, {
      user: req.user,
      branchIds: getScopedBranchIds(req.user),
      asOf: req.query.asOf || new Date(),
    });

    if (req.query.format === "csv") {
      const csv = toCsv(report.rows, [
        { key: "accountNo", header: "Account no" },
        { key: "customerName", header: "Customer" },
        { key: "branchName", header: "Branch" },
        { key: "customerPhone", header: "Phone" },
        { key: "oldestDueDate", header: "Oldest due date" },
        { key: "daysPastDue", header: "Days past due" },
        { key: "unpaidCount", header: "Unpaid invoices" },
        { key: "current", header: "Current" },
        { key: "days1to30", header: "1-30 days" },
        { key: "days31to60", header: "31-60 days" },
        { key: "days61to90", header: "61-90 days" },
        { key: "days90plus", header: "90+ days" },
        { key: "totalOwed", header: "Total owed" },
      ]);
      return sendCsv(res, `aging-${report.asOf}-${stamp()}.csv`, csv);
    }

    return res.sendSuccess("Aging report", report);
  })
);

/**
 * GET /collections — money received in a period.
 */
router.get(
  "/collections",
  checkPermission("billing", "invoices", "read"),
  validateQuery(collectionsQuerySchema),
  catchAsync(async (req, res) => {
    // Defaults to the current calendar month, which is the range somebody
    // opening this without thinking about it almost always wants.
    const from = req.query.from || moment().tz(TZ).startOf("month").format("YYYY-MM-DD");
    const to = req.query.to || moment().tz(TZ).format("YYYY-MM-DD");

    const report = await collectionsReport(req.db, {
      user: req.user,
      branchIds: getScopedBranchIds(req.user),
      from,
      to,
    });

    if (req.query.format === "csv") {
      const csv = toCsv(report.rows, [
        { key: "paidAt", header: "Received" },
        { key: "invoiceNo", header: "Invoice" },
        { key: "accountNo", header: "Account no" },
        { key: "customerName", header: "Customer" },
        { key: "branchName", header: "Branch" },
        { key: "channel", header: "Method" },
        { key: "provider", header: "Gateway" },
        { key: "recordedByName", header: "Recorded by" },
        { key: "amount", header: "Amount" },
        { key: "notes", header: "Note" },
      ]);
      return sendCsv(res, `collections-${from}-to-${to}-${stamp()}.csv`, csv);
    }

    return res.sendSuccess("Collections report", report);
  })
);

/**
 * GET /subscribers — the roster, with plan, modem and what each one owes.
 */
router.get(
  "/subscribers",
  checkPermission("subscriptions", null, "read"),
  validateQuery(subscribersQuerySchema),
  catchAsync(async (req, res) => {
    const report = await subscriberReport(req.db, {
      user: req.user,
      branchIds: getScopedBranchIds(req.user),
      status: req.query.status,
    });

    if (req.query.format === "csv") {
      const csv = toCsv(report.rows, [
        { key: "accountNo", header: "Account no" },
        { key: "customerName", header: "Customer" },
        { key: "customerPhone", header: "Phone" },
        { key: "customerEmail", header: "Email" },
        { key: "address", header: "Address" },
        { key: "branchName", header: "Branch" },
        { key: "planName", header: "Plan" },
        { key: "monthlyPrice", header: "Monthly" },
        { key: "serviceStatus", header: "Service" },
        { key: "activatedAt", header: "Activated" },
        { key: "onuMac", header: "Modem MAC" },
        { key: "provisioningState", header: "Modem state" },
        { key: "napLabel", header: "NAP" },
        { key: "unpaidCount", header: "Unpaid invoices" },
        { key: "amountOwed", header: "Amount owed" },
      ]);
      return sendCsv(res, `subscribers-${stamp()}.csv`, csv);
    }

    return res.sendSuccess("Subscriber report", report);
  })
);

/**
 * GET /operations — everything the dashboard shows, in one round trip.
 *
 * Gated on `dashboard` read rather than on billing, because it is the dashboard
 * — but note that it carries money. Anybody who can open the dashboard can see
 * what the company is owed, which is the intended reading of that permission.
 */
router.get(
  "/operations",
  checkPermission("dashboard", null, "read"),
  catchAsync(async (req, res) => {
    const summary = await operationsSummary(req.db, {
      user: req.user,
      branchIds: getScopedBranchIds(req.user),
    });

    return res.sendSuccess("Operations summary", summary);
  })
);

export default router;
