import { z } from "zod";

import {
  emptyToUndefined,
  optionalString,
  queryEnum,
  queryEnumDefault,
  queryInt,
} from "./_helpers.js";

/**
 * Network inventory validators — OLTs, PON ports, splitters, NAPs, ONUs.
 *
 * All five live in one file because they describe one chain
 * (OLT → PON port → splitter → NAP → ONU) and share the enums below; splitting
 * them would mean five files importing the same constants from a sixth.
 *
 * Every `.max()` mirrors a column width in schema.sql, and every `z.enum`
 * mirrors that column's ENUM values exactly.
 */

export const OLT_VENDORS = [
  "hsgq",
  "huawei",
  "zte",
  "fiberhome",
  "vsol",
  "bdcom",
  "mock",
  "other",
];
export const PON_TECHNOLOGIES = ["epon", "gpon"];
export const OLT_PROTOCOLS = ["ssh", "telnet", "snmp", "tr069"];
export const SPLITTER_RATIOS = ["1:2", "1:4", "1:8", "1:16", "1:32", "1:64"];
export const PROVISIONING_STATES = ["unprovisioned", "active", "suspended", "offline"];

const listQuery = (sortColumns, statuses) =>
  z.object({
    page: queryInt(1),
    pageSize: queryInt(10, { max: 100 }),
    search: z.string().max(100).optional().default(""),
    status: queryEnum(statuses),
    branchId: optionalString(50),
    sortBy: queryEnumDefault(sortColumns, "dateCreated"),
    sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
  });

/* ── OLTs ────────────────────────────────────────────────────────────────── */

/**
 * Device login. Optional so a device can be inventoried before anyone has the
 * password, and omitted on update means "leave the stored credentials alone" —
 * an edit form that cannot show a secret must not blank it either.
 */
const oltCredentials = emptyToUndefined(
  z
    .object({
      username: z.string().min(1, "Username is required").max(64),
      password: z.string().min(1, "Password is required").max(128),
      enablePassword: optionalString(128),
    })
    .optional(),
);

const oltShape = {
  name: z.string().trim().min(1, "OLT name is required").max(100),
  vendor: z.enum(OLT_VENDORS),
  ponTechnology: emptyToUndefined(z.enum(PON_TECHNOLOGIES).default("epon")),
  model: optionalString(80),
  // Hostname or IP of the management interface. Not URL-validated: this is a
  // bare host on the management VLAN, e.g. 192.168.88.10.
  host: z.string().trim().min(1, "Management host is required").max(190),
  port: z.coerce
    .number({ error: "Port must be a number" })
    .int("Port must be a whole number")
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),
  protocol: z.enum(OLT_PROTOCOLS),
  site: optionalString(120),
  // The HSGQ XE04I tolerates one CLI session; more would queue or fail.
  maxConcurrentSessions: z.coerce
    .number({ error: "Must be a number" })
    .int()
    .min(1, "At least one session is required")
    .max(16, "More than 16 concurrent sessions is unrealistic"),
  notes: optionalString(2000),
  credentials: oltCredentials,
};

export const createOltSchema = z.object({
  ...oltShape,
  branchId: optionalString(50),
});

export const updateOltSchema = z.object({
  ...oltShape,
  status: z.enum(["Active", "Maintenance", "Retired"]).optional(),
});

export const listOltsQuerySchema = listQuery(
  ["dateCreated", "dateUpdated", "name", "vendor"],
  ["Active", "Maintenance", "Retired", "Deleted"],
);

/* ── PON ports ───────────────────────────────────────────────────────────── */

const ponPortShape = {
  // Vendor formats vary — '1' on the HSGQ, '0/1/3' on a Huawei — so this is a
  // constrained string rather than a number.
  // Checked per slash-separated part rather than with `^[0-9]+(\/[0-9]+)*$` —
  // a repeated group wrapping a repeated class is the shape that backtracks
  // badly on a long non-matching input.
  portIndex: z
    .string()
    .trim()
    .min(1, "Port index is required")
    .max(32)
    .refine(
      (v) => v.split("/").every((part) => /^[0-9]{1,8}$/.test(part)),
      "Use digits separated by slashes, e.g. 1 or 0/1/3",
    ),
  capacity: z.coerce
    .number({ error: "Capacity must be a number" })
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(256, "Capacity above 256 is unrealistic for a PON"),
  description: optionalString(190),
};

export const createPonPortSchema = z.object({
  ...ponPortShape,
  oltId: z.string().min(1, "OLT is required").max(50),
});

export const updatePonPortSchema = z.object({
  ...ponPortShape,
  status: z.enum(["Active", "Down", "Reserved"]).optional(),
});

export const listPonPortsQuerySchema = listQuery(
  ["dateCreated", "dateUpdated", "portIndex"],
  ["Active", "Down", "Reserved", "Deleted"],
).extend({ oltId: optionalString(50) });

/* ── Splitters ───────────────────────────────────────────────────────────── */

const splitterShape = {
  // Polymorphic parent: a splitter hangs off a PON port or another splitter.
  // MySQL cannot FK this, so the controller checks the parent exists, is in
  // scope, and is not the splitter itself.
  parentType: z.enum(["pon_port", "splitter"]),
  parentId: z.string().min(1, "Parent is required").max(50),
  ratio: z.enum(SPLITTER_RATIOS),
  label: z.string().trim().min(1, "Label is required").max(120),
  location: optionalString(190),
};

export const createSplitterSchema = z.object(splitterShape);

export const updateSplitterSchema = z.object({
  ...splitterShape,
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listSplittersQuerySchema = listQuery(
  ["dateCreated", "dateUpdated", "label", "ratio"],
  ["Active", "Inactive", "Deleted"],
).extend({ parentType: queryEnum(["pon_port", "splitter"]), parentId: optionalString(50) });

/* ── NAPs ────────────────────────────────────────────────────────────────── */

// Required here, unlike on a customer: a NAP with no coordinates cannot be
// found by a technician, and the map is the reason the record exists.
const requiredCoordinate = (label, limit) =>
  z.coerce
    .number({ error: `${label} is required` })
    .min(-limit, `${label} must be between -${limit} and ${limit}`)
    .max(limit, `${label} must be between -${limit} and ${limit}`);

const napShape = {
  splitterId: z.string().min(1, "Splitter is required").max(50),
  label: z.string().trim().min(1, "Label is required").max(120),
  totalPorts: z.coerce
    .number({ error: "Port count must be a number" })
    .int("Port count must be a whole number")
    .min(1, "A NAP needs at least one port")
    .max(64, "More than 64 ports is unrealistic for a NAP"),
  gpsLat: requiredCoordinate("Latitude", 90),
  gpsLng: requiredCoordinate("Longitude", 180),
  address: optionalString(255),
  notes: optionalString(2000),
};

export const createNapSchema = z.object(napShape);

export const updateNapSchema = z.object({
  ...napShape,
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listNapsQuerySchema = listQuery(
  ["dateCreated", "dateUpdated", "label"],
  ["Active", "Inactive", "Deleted"],
).extend({ splitterId: optionalString(50) });

/* ── ONUs ────────────────────────────────────────────────────────────────── */

/**
 * MAC address, normalised to lowercase colon-separated form.
 *
 * Devices report it three ways — `30:c5:0f:d8:7f:2c`, `30-c5-0f-d8-7f-2c` and
 * the Cisco-style `30c5.0fd8.7f2c` seen on the HSGQ — and on EPON the MAC is
 * the ONU's identity and the join key against MikroTik sessions. Storing three
 * spellings of the same address would silently break that match, so all three
 * are accepted and one is stored.
 */
const optionalMac = emptyToUndefined(
  z
    .string()
    .max(20)
    .optional()
    .refine(
      (v) => v === undefined || /^[0-9a-f]{12}$/i.test(v.replace(/[:.-]/g, "")),
      "MAC must be 12 hex digits, e.g. 30:c5:0f:d8:7f:2c",
    )
    .transform((v) => {
      if (v === undefined) return undefined;
      const hex = v.replace(/[:.-]/g, "").toLowerCase();
      return hex.match(/.{2}/g).join(":");
    }),
);

const onuShape = {
  serialNo: optionalString(64),
  mac: optionalMac,
  model: optionalString(80),
  napId: optionalString(50),
  napPort: emptyToUndefined(
    z.coerce
      .number({ error: "NAP port must be a number" })
      .int("NAP port must be a whole number")
      .min(1, "NAP port starts at 1")
      .max(64, "NAP port above 64 is unrealistic")
      .optional(),
  ),
  oltId: optionalString(50),
  ponPortId: optionalString(50),
  onuIndex: emptyToUndefined(
    z
      .string()
      .max(32)
      .optional()
      .refine(
        (v) => v === undefined || /^\d+\/\d+$/.test(v),
        "ONU index is 'pon/onu-id', e.g. 1/27",
      ),
  ),
  // Free text the previous operator wrote on the device, e.g.
  // "Jacqueline-Rebancos PON 2 NAP 1 PORT 5". Discovery parses it in S10.
  description: optionalString(255),
  notes: optionalString(2000),
};

export const createOnuSchema = z
  .object({ ...onuShape, branchId: optionalString(50) })
  // One of the two identifiers must be present: on EPON it is the MAC, on GPON
  // the serial. A record with neither cannot be matched to a device at all.
  .refine(
    (data) => Boolean(data.serialNo) || Boolean(data.mac),
    { message: "Provide a serial number or a MAC address", path: ["mac"] },
  );

export const updateOnuSchema = z
  .object({
    ...onuShape,
    // `provisioningState` is deliberately absent: it is owned by the
    // provisioning worker and only ever changes after a confirmed device
    // response. `recordStatus` is the inventory flag staff may edit.
    recordStatus: z.enum(["Active", "Inactive"]).optional(),
  })
  .refine(
    (data) => Boolean(data.serialNo) || Boolean(data.mac),
    { message: "Provide a serial number or a MAC address", path: ["mac"] },
  );

export const listOnusQuerySchema = z.object({
  page: queryInt(1),
  pageSize: queryInt(10, { max: 100 }),
  search: z.string().max(100).optional().default(""),
  recordStatus: queryEnum(["Active", "Inactive", "Deleted"]),
  provisioningState: queryEnum(PROVISIONING_STATES),
  branchId: optionalString(50),
  oltId: optionalString(50),
  napId: optionalString(50),
  sortBy: queryEnumDefault(
    ["dateCreated", "dateUpdated", "serialNo", "mac", "provisioningState"],
    "dateCreated",
  ),
  sortOrder: queryEnumDefault(["ASC", "DESC"], "DESC"),
});
