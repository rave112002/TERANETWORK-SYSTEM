import { z } from "zod";
import { optionalPhone, optionalString } from "./_helpers.js";

/**
 * The company's own branding and contact details — the identity that invoice
 * PDFs and customer emails render. Changed from the central SuperAdmin through
 * the management API (controllers/v1/manage/company.controller.js, D10).
 *
 * The logo is not part of this body; it has its own upload endpoint.
 */
export const updateCompanyProfileSchema = z.object({
  name: z.string().min(1, "Company name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email address").max(100),
  phone: optionalPhone(),
  website: optionalString(255),
  logoUrl: optionalString(255),
  address: optionalString(500),
  tin: optionalString(20),
});
