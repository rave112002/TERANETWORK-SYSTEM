import { z } from "zod";

import {
  optionalLatitude,
  optionalLongitude,
  optionalPhone,
  optionalString,
  queryEnum,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

/**
 * Subscribers.
 *
 * `email` is REQUIRED and that is a business rule, not a form preference:
 * invoices are delivered by email only, so a subscriber without one cannot be
 * billed. The column is NOT NULL to match.
 *
 * Everything else mirrors the NULLable columns in schema.sql — optional fields
 * validate shape, not presence, and go through the `_helpers.js` wrappers so
 * `""`, `null` and an omitted key all mean "no value".
 */

const customerShape = {
  name: z.string().trim().min(1, "Customer name is required").max(150),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email")
    .max(100),
  phone: optionalPhone(),
  address: optionalString(1000),
  // Plots the subscriber on the NAP map.
  gpsLat: optionalLatitude(),
  gpsLng: optionalLongitude(),
  idType: optionalString(40),
  idNumber: optionalString(64),
  notes: optionalString(2000),
};

// POST / — create a subscriber
export const createCustomerSchema = z.object({
  ...customerShape,
  // Which branch the subscriber belongs to. Omitted means the creating user's
  // home branch; anything explicit is checked against their own scope in the
  // controller, so a branch they cannot see can never be targeted.
  branchId: optionalString(50),
});

// PUT /:customerId — update a subscriber
export const updateCustomerSchema = z.object({
  ...customerShape,
  status: z.enum(["Active", "Inactive"]).optional(),
});

// GET / — list query params (a cleared filter arrives as "", see _helpers.js)
export const listCustomersQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  status: queryEnum(["Active", "Inactive", "Deleted"]),
  branchId: optionalString(50),
  sortBy: queryEnumDefault(
    ["dateCreated", "dateUpdated", "name", "accountNo"],
    "dateCreated",
  ),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
