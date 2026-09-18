import crypto from "node:crypto";
import path from "node:path";

import express from "express";

import { catchAsync, validateBody } from "../../../utils/catchAsync.js";
import { writeAudit } from "../../../utils/audit.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { compressImage, upload } from "../../../utils/file/uploads.js";
import { updateCompanyProfileSchema } from "../../../validators/companies.validator.js";
import {
  COMPANY_COLUMNS,
  loadInstallation,
  manageAuditContext,
} from "../../../lib/manage/installation.js";
import { MAX_LOGO_BYTES } from "../../../../../../shared/manage-contract/index.js";

const router = express.Router();

/**
 * Company profile, managed from the central SuperAdmin (D10): the name, logo,
 * address, TIN and contact details printed on this branch's invoices and
 * emails. Mounted at /api/v1/manage/company-profile, behind the management key.
 *
 * ── Who changed it ──────────────────────────────────────────────────────────
 *
 * There is no logged-in user here. SuperAdmin sends the person's name in the
 * actor header, and every change is written to this branch's audit trail as
 * `system:superadmin:<name>`, in the same transaction as the change.
 */

/** PNG and JPEG only: the invoice PDF renderer cannot draw WebP, GIF or HEIC. */
const LOGO_TYPES = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] };

const PROFILE_COLUMNS = COMPANY_COLUMNS;

/** What the manage contract calls `CompanyProfile`. The file path stays on this server. */
const toProfile = (c) => ({
  name: c.name,
  email: c.email,
  phone: c.phone,
  website: c.website,
  address: c.address,
  tin: c.tin,
  hasLogo: Boolean(c.logoUrl),
  logoVersion: c.logoUrl
    ? crypto.createHash("sha1").update(c.logoUrl).digest("hex").slice(0, 12)
    : null,
});

/** Absolute path of a stored `/uploads/…` logo, or null if it escapes public/uploads. */
const logoFilePath = (logoUrl) => {
  if (!logoUrl) return null;
  const root = path.resolve("public", "uploads");
  const abs = path.resolve("public", String(logoUrl).replace(/^\/+/, ""));
  return abs.startsWith(root + path.sep) ? abs : null;
};

const changeCompany = async (req, { action, description, set, params }) => {
  const { company } = req.installation;
  let conn;
  try {
    conn = await req.db.beginTransaction();
    const now = getCurrentTimestampLocal();
    await conn.execute(`UPDATE companies SET ${set}, dateUpdated = ? WHERE companyId = ?`, [
      ...params,
      now,
      company.companyId,
    ]);
    const [rows] = await conn.execute(
      `SELECT ${PROFILE_COLUMNS} FROM companies WHERE companyId = ?`,
      [company.companyId]
    );
    await writeAudit(conn, {
      context: manageAuditContext(req),
      module: "companies",
      action,
      description,
      before: company,
      after: rows[0],
    });
    await req.db.commit(conn);
    return rows[0];
  } catch (err) {
    if (conn) await req.db.rollback(conn);
    throw err;
  }
};

router.use(loadInstallation);

/** GET / */
router.get("/", (req, res) =>
  res.sendSuccess("Company profile", { company: toProfile(req.installation.company) })
);

/** PUT / — everything except the logo. */
router.put(
  "/",
  validateBody(updateCompanyProfileSchema.omit({ logoUrl: true })),
  catchAsync(async (req, res) => {
    const { name, email, phone, website, address, tin } = req.body;

    const [clash] = await req.db.query(
      `SELECT companyId FROM companies WHERE email = ? AND companyId != ? AND status != 'Deleted' LIMIT 1`,
      [email, req.installation.company.companyId]
    );
    if (clash) return res.sendError("Another company already uses this email", 409);

    const updated = await changeCompany(req, {
      action: "update_profile",
      description: "Company profile updated from SuperAdmin",
      set: "name = ?, email = ?, phone = ?, website = ?, address = ?, tin = ?",
      params: [name, email, phone || null, website || null, address || null, tin || null],
    });
    return res.sendSuccess("Company profile updated", { company: toProfile(updated) });
  })
);

const logoUpload = upload({
  filePath: (req) => `uploads/superadmin/logos/${req.installation.company.companyId}`,
  allowedTypes: LOGO_TYPES,
  maxFileSize: MAX_LOGO_BYTES,
});

/** PUT /logo — multipart, field `logo`. */
router.put(
  "/logo",
  logoUpload.single("logo"),
  compressImage,
  catchAsync(async (req, res) => {
    if (!req.file) return res.sendError("Choose a PNG or JPG image", 400);
    const logoUrl = `/${path.relative("public", req.file.path).replace(/\\/g, "/")}`;

    const updated = await changeCompany(req, {
      action: "update_logo",
      description: "Company logo replaced from SuperAdmin",
      set: "logoUrl = ?",
      params: [logoUrl],
    });
    return res.sendSuccess("Logo updated", { company: toProfile(updated) });
  })
);

/** DELETE /logo — invoices fall back to the company name in text. */
router.delete(
  "/logo",
  catchAsync(async (req, res) => {
    const updated = await changeCompany(req, {
      action: "remove_logo",
      description: "Company logo removed from SuperAdmin",
      set: "logoUrl = NULL",
      params: [],
    });
    return res.sendSuccess("Logo removed", { company: toProfile(updated) });
  })
);

/** GET /logo — the image itself, so SuperAdmin can show it without reaching /public. */
router.get("/logo", (req, res) => {
  const file = logoFilePath(req.installation.company.logoUrl);
  if (!file) return res.sendError("This branch has no logo", 404, undefined, "NO_LOGO");
  res.setHeader("Cache-Control", "no-store");
  return res.sendFile(file, (err) => {
    if (err && !res.headersSent)
      res.sendError("The logo file is missing", 404, undefined, "NO_LOGO");
  });
});

export default router;
