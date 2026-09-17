import { z } from "zod";
import { emptyToUndefined, optionalEmail, optionalPhone, optionalString } from "./_helpers.js";

/** An http(s) link, tolerant of "". Anything else printed on an invoice is a broken or unsafe link. */
const optionalWebLink = (max = 255) =>
  emptyToUndefined(
    z
      .string()
      .trim()
      .max(max)
      .optional()
      .refine((v) => {
        if (v === undefined) return true;
        try {
          return ["http:", "https:"].includes(new URL(v).protocol);
        } catch {
          return false;
        }
      }, "Enter the full link, starting with https://")
  );

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

  // How customers pay (docs/payments.md). Printed on every invoice and billing
  // email, so staff can change the number or page without a deploy.
  gcashNumber: optionalPhone(),
  gcashAccountName: optionalString(100),
  facebookPageUrl: optionalWebLink(255),
  // Printed at the bottom of every invoice PDF; left off when blank.
  invoiceTerms: optionalString(1500),
});

// Defaults returned when a tenant has no stored value for a key.
export const SETTINGS_DEFAULTS = {
  companyDisplayName: "",
  supportEmail: "",
  dateFormat: "MMM D, YYYY",
  timezone: "Asia/Manila",
  weekStartsOn: "Monday",
  gcashNumber: "",
  gcashAccountName: "",
  facebookPageUrl: "",
  invoiceTerms: "",
};
