import { z } from "zod";
import { optionalString, optionalEmail, emptyToUndefined } from "./_helpers.js";

// The curated set of tenant settings the Admin portal can edit. All optional so
// the form can send partial updates; unknown keys are stripped by Zod.
export const updateSettingsSchema = z.object({
  companyDisplayName: optionalString(100),
  supportEmail: optionalEmail(100),
  dateFormat: emptyToUndefined(
    z.enum(["MMM D, YYYY", "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]).optional()
  ),
  timezone: optionalString(50),
  weekStartsOn: emptyToUndefined(z.enum(["Sunday", "Monday"]).optional()),
});

// Defaults returned when a tenant has no stored value for a key.
export const SETTINGS_DEFAULTS = {
  companyDisplayName: "",
  supportEmail: "",
  dateFormat: "MMM D, YYYY",
  timezone: "Asia/Manila",
  weekStartsOn: "Monday",
};
