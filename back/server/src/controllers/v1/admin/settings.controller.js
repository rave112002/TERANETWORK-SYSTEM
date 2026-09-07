import express from "express";
import { catchAsync, validateBody } from "../../../utils/catchAsync.js";
import { getCurrentTimestampLocal } from "../../../utils/dateUtils.js";
import { checkPermission } from "../../../middlewares/checkPermission.middleware.js";
import {
  updateSettingsSchema,
  SETTINGS_DEFAULTS,
} from "../../../validators/settings.validator.js";

const router = express.Router();

/**
 * GET /
 * Return the tenant's settings (stored values merged over defaults).
 *
 * Deliberately keyed on the user's HOME branch (`req.user.branchId`) rather
 * than their full branch scope: `settings` holds one row per
 * (companyId, branchId, settingKey), so a multi-branch user reading "the"
 * settings has to be reading one specific branch's. Editing another branch's
 * settings is a SuperAdmin action. See utils/branchScope.js for the
 * scope-vs-home-branch distinction.
 */
router.get(
  "/",
  checkPermission("settings", null, "read"),
  catchAsync(async (req, res) => {
    const { companyId, branchId } = req.user;

    const rows = await req.db.query(
      `SELECT settingKey, settingValue FROM settings WHERE companyId = ? AND branchId = ?`,
      [companyId, branchId]
    );
    const stored = Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue]));

    return res.sendSuccess("Settings retrieved successfully", {
      settings: { ...SETTINGS_DEFAULTS, ...stored },
    });
  })
);

/**
 * PUT /
 * Upsert the provided settings for the tenant (partial updates allowed).
 */
router.put(
  "/",
  checkPermission("settings", null, "write"),
  validateBody(updateSettingsSchema),
  catchAsync(async (req, res) => {
    const { companyId, branchId } = req.user;
    const entries = Object.entries(req.body);
    const now = getCurrentTimestampLocal();

    if (entries.length > 0) {
      let conn;
      try {
        conn = await req.db.beginTransaction();
        for (const [key, value] of entries) {
          await conn.execute(
            `INSERT INTO settings (companyId, branchId, settingKey, settingValue, dateCreated, dateUpdated)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), dateUpdated = VALUES(dateUpdated)`,
            [companyId, branchId, key, value === null || value === undefined ? null : String(value), now, now]
          );
        }
        await req.db.commit(conn);
      } catch (err) {
        await req.db.rollback(conn);
        throw err;
      }
    }

    // Return the full merged settings so the client can refresh its state
    const rows = await req.db.query(
      `SELECT settingKey, settingValue FROM settings WHERE companyId = ? AND branchId = ?`,
      [companyId, branchId]
    );
    const stored = Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue]));

    return res.sendSuccess("Settings updated successfully", {
      settings: { ...SETTINGS_DEFAULTS, ...stored },
    });
  })
);

export default router;
