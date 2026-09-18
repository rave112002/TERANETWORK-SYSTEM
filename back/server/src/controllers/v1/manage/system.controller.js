import express from "express";

import { catchAsync, validateBody } from "../../../utils/catchAsync.js";
import { loadInstallation, manageAuditContext } from "../../../lib/manage/installation.js";
import {
  readSystemSettings,
  updateSystemSettings,
} from "../../../lib/settings/systemSettings.service.js";
import { updateSettingsSchema } from "../../../validators/system.validator.js";

const router = express.Router();

/**
 * Runtime settings — dry-run, billing schedule, grace days, VAT, pull-out
 * delay — managed from the central SuperAdmin (D10). Mounted at
 * /api/v1/manage/system-settings, behind the management key.
 *
 * Same validation, same whole-schedule check and same audited transaction as
 * the branch's own Admin portal: both call lib/settings/systemSettings.service.js.
 * Changes are recorded as `system:superadmin:<user>`.
 */

router.use(loadInstallation);

/** GET / */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const result = await readSystemSettings(req.db, req.installation.company.companyId);
    return res.sendSuccess("System settings", result);
  })
);

/** PUT / — partial: send only what changes. */
router.put(
  "/",
  validateBody(updateSettingsSchema),
  catchAsync(async (req, res) => {
    const context = manageAuditContext(req);
    const result = await updateSystemSettings(req.db, {
      companyId: req.installation.company.companyId,
      updates: req.body,
      updatedBy: context.accountId,
      context,
    });
    if (result.error) return res.sendError(result.error, 400, undefined, "SCHEDULE_INVALID");

    const saved = await readSystemSettings(req.db, req.installation.company.companyId);
    return res.sendSuccess("System settings saved", { ...saved, changed: result.changed });
  })
);

export default router;
