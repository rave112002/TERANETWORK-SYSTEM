/**
 * Development seed data — ONE branch, realistic enough to test every screen.
 *
 * ⚠️  DEVELOPMENT / TEST ONLY. Refuses to run with NODE_ENV=production.
 *
 * Run after `npm run db:setup`, against the branch that setup created:
 *
 *   npm run db:seed:dev
 *
 * ── What it builds ──────────────────────────────────────────────────────────
 *
 *   6 plans · 2 OLTs · PON ports · cascaded splitters · 5 NAPs · 21 ONUs
 *   20 subscribers across every lifecycle state:
 *     active · active-but-overdue (exempted) · suspended · awaiting pull-out ·
 *     for_recovery · terminated (modem recovered) · pending installation
 *   ~7 months of invoices: paid, overdue, voided, prorated, with install fees,
 *   credits, discounts and debits · payments (GCash + cash) · dunning
 *   exemptions (live and revoked) · email history · device action logs
 *
 * ── Why it cannot hurt anything ─────────────────────────────────────────────
 *
 *   - NO rows in `jobs`. A running worker has nothing seeded to act on.
 *   - The OLTs use the `mock` driver, on 192.0.2.x (RFC 5737 TEST-NET-1, which
 *     is unroutable), so even a vendor edit cannot reach real hardware.
 *   - Every active subscription with an overdue invoice has a live dunning
 *     exemption, so the nightly sweep finds nothing to disconnect.
 *   - Customer emails are @example.com (RFC 2606, reserved) and phones use the
 *     unassigned 0900 prefix — no real person can be contacted.
 *
 * ── Dates are relative to today ─────────────────────────────────────────────
 *
 * The timeline is built backwards from the last statement date that has
 * already passed, using the installation's own billing schedule, so the data
 * stays coherent (no invoice dated in the future, nobody suspended before
 * their bill was due) whenever the seed is run.
 *
 * Money and dates go through the same helpers the billing engine uses —
 * `computeBilledPeriod`, `serviceDaysInPeriod`, `buildInvoiceComputation`,
 * `allocateInvoiceNo`, `nextAccountNo` — so seeded invoices are computed
 * exactly as real ones are.
 */

import "dotenv/config";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import moment from "moment-timezone";

import { computeBilledPeriod, serviceDaysInPeriod } from "../server/src/lib/billing/billing.dates.js";
import { allocateInvoiceNo } from "../server/src/lib/billing/cycle.service.js";
import { buildInvoiceComputation } from "../server/src/lib/billing/invoice.calc.js";
import { nextAccountNo } from "../server/src/lib/counters/counters.js";
import {
  getBillingSchedule,
  getRecoveryAfterDays,
  getVatRate,
} from "../server/src/lib/settings/settings.service.js";

const TZ = process.env.TIMEZONE || "Asia/Manila";
const DT = "YYYY-MM-DD HH:mm:ss";
const D = "YYYY-MM-DD";

// ── Deterministic randomness, so two runs produce the same shape ────────────

const rng = (() => {
  let a = 20260916;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const digits = (n) => Array.from({ length: n }, () => randInt(0, 9)).join("");
const hex = (n) => Array.from({ length: n }, () => randInt(0, 15).toString(16)).join("").toUpperCase();

// ── The data ────────────────────────────────────────────────────────────────

const PLANS = {
  f30: { name: "Fiber 30", down: 30, up: 30, price: "999.00", install: "1500.00" },
  f50: { name: "Fiber 50", down: 50, up: 50, price: "1299.00", install: "1500.00" },
  f100: { name: "Fiber 100", down: 100, up: 100, price: "1699.00", install: "1000.00" },
  f200: { name: "Fiber 200", down: 200, up: 200, price: "2299.00", install: "0.00" },
  biz300: { name: "Business 300", down: 300, up: 300, price: "3499.00", install: "2500.00" },
  // Retired from sale; existing subscribers keep it. Exercises the Inactive badge.
  legacy25: { name: "Legacy 25", down: 25, up: 10, price: "899.00", install: "1500.00", inactive: true },
};

const STREETS = [
  "Sampaguita St.", "Ilang-Ilang St.", "Gen. Espiritu St.", "M.L. Quezon St.",
  "Rosal St.", "Camia St.", "Purok 3", "Purok 5", "Kalayaan Ave.", "Waling-Waling St.",
];
const ID_TYPES = ["PhilSys ID", "Driver's License", "UMID", "Passport", "Postal ID"];

/**
 * `act` is [month offset from the last billed month, day]. Scenario offsets are
 * relative to the latest invoice already past due (see `pastDue` below).
 */
const CUSTOMERS = [
  { name: "Maria Santos", plan: "f100", nap: 0, act: [6, 3], scenario: "good", revokedExemption: true },
  { name: "Jose Reyes", plan: "f50", nap: 0, act: [6, 10], scenario: "late", lateAt: 3, cash: true },
  { name: "Ana Cruz", plan: "f30", nap: 0, act: [5, 7], scenario: "suspended" },
  { name: "Mark Bautista", plan: "f200", nap: 0, act: [6, 15], scenario: "good", pendingCredit: true },
  { name: "Kristine Garcia", plan: "f50", nap: 0, act: [5, 20], scenario: "exempt_current" },
  { name: "Mendoza Printing Services", plan: "biz300", nap: 0, act: [6, 1], scenario: "good", loyaltyDiscount: true, business: true },
  { name: "Liza Villanueva", plan: "f50", nap: 1, act: [4, 18], scenario: "for_recovery", unpaidAt: 3, emailBounced: true },
  { name: "Ramon Dela Cruz", plan: "legacy25", nap: 1, act: [6, 5], scenario: "good", cash: true, pendingDebit: true },
  { name: "Jenny Ramos", plan: "f100", nap: 1, act: [5, 9], scenario: "good", voidAt: 3 },
  { name: "Carlo Aquino", plan: "f30", nap: 1, act: [4, 12], scenario: "suspended_long", unpaidAt: 2 },
  { name: "Grace Fernandez", plan: "f50", nap: 1, act: [6, 8], scenario: "terminated", terminatedAt: 2 },
  { name: null /* Barangay Hall, named after the branch */, plan: "biz300", nap: 2, act: [6, 2], scenario: "exempt_two", business: true },
  { name: "Rodel Castillo", plan: "f100", nap: 2, act: [5, 14], scenario: "good", outageCredit: true },
  { name: "Michelle Torres", plan: "f50", nap: 2, act: [6, 11], scenario: "good", outageCredit: true, onuOffline: true },
  { name: "Antonio Navarro", plan: "f200", nap: 2, act: [3, 16], scenario: "for_recovery", unpaidAt: 2 },
  { name: "Joanna Pascual", plan: "f100", nap: 3, act: [4, 4], scenario: "late", lateAt: 2, cableDebit: true },
  { name: "Eduardo Lim", plan: "f50", nap: 3, act: [1, 5], scenario: "good" },
  { name: "Sheila Mercado", plan: "f30", nap: 3, act: [0, 12], scenario: "good" },
  { name: "Vincent Gonzales", plan: "f200", nap: 4, act: [6, 19], scenario: "good", weakSignal: true },
  { name: "Rosario Flores", plan: "f50", nap: null, act: null, scenario: "pending" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const initials = (s) =>
  s.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 4) || "BR";

const slug = (name) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

const phone = (i) => `0900 0000 ${String(i + 1).padStart(3, "0")}`;

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Refusing to seed development data with NODE_ENV=production.");
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    timezone: "+08:00",
    dateStrings: true,
  });

  // The settings service expects the app's Database wrapper, whose query()
  // returns rows directly.
  const db = { query: async (sql, params = []) => (await conn.query(sql, params))[0] };

  const uuid = async () => (await conn.execute("SELECT UUID() AS id"))[0][0].id;
  const insert = async (table, row) => {
    const cols = Object.keys(row);
    await conn.execute(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      cols.map((c) => (row[c] === undefined ? null : row[c]))
    );
  };

  try {
    // ── Resolve the installation ──────────────────────────────────────────
    const companies = await db.query(`SELECT companyId FROM companies WHERE status != 'Deleted'`);
    if (companies.length !== 1) {
      throw new Error(`Expected exactly one company, found ${companies.length}. Run npm run db:setup first.`);
    }
    const { companyId } = companies[0];

    const branches = await db.query(
      `SELECT branchId, name FROM branches WHERE companyId = ? AND status != 'Deleted' ORDER BY id`,
      [companyId]
    );
    const wanted = process.env.BRANCH_NAME?.trim();
    const branch =
      branches.length === 1 ? branches[0] : branches.find((b) => wanted && b.name === wanted);
    if (!branch) {
      throw new Error(
        branches.length === 0
          ? "No branch found. Run npm run db:setup first."
          : `${branches.length} branches exist; set BRANCH_NAME to the one to seed.`
      );
    }
    const { branchId } = branch;
    const code = initials(branch.name);

    // ── Refuse to seed twice ──────────────────────────────────────────────
    const [{ n: existing }] = await db.query(
      `SELECT (SELECT COUNT(*) FROM customers WHERE branchId = ?)
            + (SELECT COUNT(*) FROM olts WHERE branchId = ?)
            + (SELECT COUNT(*) FROM plans WHERE companyId = ?) AS n`,
      [branchId, branchId, companyId]
    );
    if (Number(existing) > 0) {
      console.log(
        `⏭️  Branch "${branch.name}" already has plans, OLTs or customers — not seeding over existing data.\n` +
          "   For a fresh dataset: npm run db:setup:clean && npm run db:seed:dev"
      );
      return;
    }

    const owners = await db.query(
      `SELECT u.accountId FROM users u JOIN roles r ON r.roleId = u.roleId
        WHERE u.branchId = ? AND r.roleName = 'Owner' AND u.status != 'Deleted' LIMIT 1`,
      [branchId]
    );
    const staffId = owners[0]?.accountId ?? null;
    const staffActor = staffId ? `user:${staffId}` : "system:seed";

    const schedule = await getBillingSchedule(db, companyId);
    const vatRate = await getVatRate(db, companyId);
    const recoveryAfterDays = await getRecoveryAfterDays(db, companyId);

    // ── The timeline ──────────────────────────────────────────────────────
    const now = moment.tz(TZ);
    const today = now.format(D);

    // Offset 0 = the latest month whose statement date has already passed.
    let last = now.clone().startOf("month");
    if (computeBilledPeriod(last.format(D), schedule).statementDate > today) {
      last = last.subtract(1, "month");
    }
    const periodAt = (k) => computeBilledPeriod(last.clone().subtract(k, "months").format(D), schedule);

    // The latest invoice that is already past due. Scenario offsets hang off
    // this, so "suspended for an unpaid bill" is always true on the day it runs.
    const pastDue = periodAt(0).dueDate < today ? 0 : 1;
    const at = (hour, date) =>
      moment.tz(date, TZ).hour(hour).minute(randInt(0, 59)).second(randInt(0, 59));
    const dunningAt = (dueDate) => at(schedule.dunningHour ?? 10, dueDate);

    await conn.beginTransaction();

    // ── Plans ─────────────────────────────────────────────────────────────
    const stamp = now.clone().subtract(8, "months").format(DT);
    const planIds = {};
    for (const [key, p] of Object.entries(PLANS)) {
      planIds[key] = await uuid();
      await insert("plans", {
        planId: planIds[key],
        companyId,
        name: p.name,
        description: `${p.down} Mbps down / ${p.up} Mbps up, unlimited data`,
        downMbps: p.down,
        upMbps: p.up,
        monthlyPrice: p.price,
        installFee: p.install,
        status: p.inactive ? "Inactive" : "Active",
        dateCreated: stamp,
        dateUpdated: stamp,
      });
    }

    // ── Network: OLT → PON port → splitter (cascaded) → NAP ───────────────
    const oltId = await uuid();
    await insert("olts", {
      oltId, companyId, branchId,
      name: `OLT-${code}-01`,
      vendor: "mock",
      ponTechnology: "epon",
      model: "HSGQ XE04I (mock driver)",
      host: "192.0.2.10",
      port: 23,
      protocol: "telnet",
      site: `${branch.name} head-end`,
      maxConcurrentSessions: 1,
      notes: "Development seed. Mock driver on a TEST-NET address — never reaches hardware.",
      status: "Active",
      dateCreated: stamp, dateUpdated: stamp,
    });

    const olt2Id = await uuid();
    await insert("olts", {
      oltId: olt2Id, companyId, branchId,
      name: `OLT-${code}-02`,
      vendor: "mock",
      ponTechnology: "epon",
      model: "HSGQ XE04I (mock driver)",
      host: "192.0.2.11",
      port: 23,
      protocol: "telnet",
      site: `${branch.name} expansion cabinet`,
      maxConcurrentSessions: 1,
      notes: "Development seed. Awaiting power supply replacement.",
      status: "Maintenance",
      dateCreated: stamp, dateUpdated: stamp,
    });

    const ponIds = {};
    const ports = [
      [oltId, "1", "Active", "Feeds Gen. Espiritu / Sampaguita area"],
      [oltId, "2", "Active", "Feeds Kalayaan Ave. corridor"],
      [oltId, "3", "Active", "Spare — no subscribers yet"],
      [oltId, "4", "Reserved", "Held for Purok 7 expansion"],
      [olt2Id, "1", "Down", "OLT in maintenance"],
      [olt2Id, "2", "Down", "OLT in maintenance"],
    ];
    for (const [o, idx, status, description] of ports) {
      const id = await uuid();
      ponIds[`${o === oltId ? 1 : 2}/${idx}`] = id;
      await insert("pon_ports", {
        ponPortId: id, companyId, branchId, oltId: o, portIndex: idx,
        capacity: 64, description, status, dateCreated: stamp, dateUpdated: stamp,
      });
    }

    const splitter = async (parentType, parentId, ratio, label, location) => {
      const id = await uuid();
      await insert("splitters", {
        splitterId: id, companyId, branchId, parentType, parentId, ratio, label, location,
        status: "Active", dateCreated: stamp, dateUpdated: stamp,
      });
      return id;
    };
    const splP1 = await splitter("pon_port", ponIds["1/1"], "1:4", `SPL-${code}-P1`, "Pole 14, Gen. Espiritu St.");
    const splP1A = await splitter("splitter", splP1, "1:8", `SPL-${code}-P1A`, "Pole 22, Sampaguita St.");
    const splP1B = await splitter("splitter", splP1, "1:8", `SPL-${code}-P1B`, "Pole 31, Ilang-Ilang St.");
    const splP2 = await splitter("pon_port", ponIds["1/2"], "1:8", `SPL-${code}-P2`, "Cabinet 2, Kalayaan Ave.");
    await splitter("pon_port", ponIds["1/3"], "1:4", `SPL-${code}-P3`, "Cabinet 3 (unused)");

    // Around a Taguig barangay centre; offsets keep NAPs a few hundred metres apart.
    const BASE = { lat: 14.4905, lng: 121.06 };
    const NAPS = [
      { splitterId: splP1A, pon: "1", label: `NAP-${code}-01`, dLat: 0.0012, dLng: -0.0015, street: "Sampaguita St.", ports: 8 },
      { splitterId: splP1A, pon: "1", label: `NAP-${code}-02`, dLat: 0.0021, dLng: 0.0004, street: "Rosal St.", ports: 8 },
      { splitterId: splP1B, pon: "1", label: `NAP-${code}-03`, dLat: -0.0009, dLng: 0.0018, street: "Ilang-Ilang St.", ports: 8 },
      { splitterId: splP2, pon: "2", label: `NAP-${code}-04`, dLat: -0.0024, dLng: -0.0011, street: "Kalayaan Ave.", ports: 16 },
      { splitterId: splP2, pon: "2", label: `NAP-${code}-05`, dLat: -0.0031, dLng: 0.0026, street: "Purok 5", ports: 8 },
    ];
    for (const nap of NAPS) {
      nap.napId = await uuid();
      nap.lat = (BASE.lat + nap.dLat).toFixed(7);
      nap.lng = (BASE.lng + nap.dLng).toFixed(7);
      nap.nextPort = 1;
      await insert("naps", {
        napId: nap.napId, companyId, branchId, splitterId: nap.splitterId, label: nap.label,
        totalPorts: nap.ports, gpsLat: nap.lat, gpsLng: nap.lng,
        address: `${nap.street}, ${branch.name}, Taguig City`,
        status: "Active", dateCreated: stamp, dateUpdated: stamp,
      });
    }

    // ── Counters used in the summary ──────────────────────────────────────
    const tally = { invoices: {}, subscriptions: {}, payments: 0, onus: 0, charges: 0, exemptions: 0, logs: 0, emails: 0 };
    const bump = (obj, key) => (obj[key] = (obj[key] ?? 0) + 1);
    const ponSeq = { 1: 0, 2: 0 };

    const logAction = async (row) => {
      tally.logs += 1;
      await insert("network_action_logs", {
        actionLogId: await uuid(), companyId, branchId, oltId, jobId: null, ...row,
      });
    };
    const emailEvent = async (row) => {
      tally.emails += 1;
      await insert("email_events", {
        emailEventId: await uuid(), companyId, providerStatus: "sent",
        providerMsgId: `<${hex(16).toLowerCase()}@mail.teranetwork.local>`,
        dateUpdated: row.dateCreated, ...row,
      });
    };

    const ONU_MODELS = ["HSGQ-E04 EPON ONU", "HSGQ-E01 EPON ONU", "V-SOL V2801RH"];

    // ── Subscribers ───────────────────────────────────────────────────────
    for (const [i, c] of CUSTOMERS.entries()) {
      const name = c.name ?? `Barangay ${branch.name} Hall`;
      const plan = PLANS[c.plan];
      const planId = planIds[c.plan];
      const nap = c.nap === null ? null : NAPS[c.nap];
      const email = c.business
        ? `billing.${slug(name)}@example.com`
        : `${slug(name)}@example.com`;

      const activatedAt = c.act
        ? at(14, last.clone().subtract(c.act[0], "months").date(c.act[1]).format(D))
        : null;
      const signedUpAt = activatedAt
        ? activatedAt.clone().subtract(randInt(5, 10), "days").hour(10)
        : now.clone().subtract(2, "days").hour(11);

      // Customer
      const customerId = await uuid();
      const accountNo = await nextAccountNo(conn, companyId);
      await insert("customers", {
        customerId, companyId, branchId, accountNo, name, email,
        phone: phone(i),
        address: `Blk ${randInt(1, 40)} Lot ${randInt(1, 30)}, ${nap?.street ?? pick(STREETS)}, ${branch.name}, Taguig City`,
        gpsLat: nap ? (Number(nap.lat) + (rng() - 0.5) * 0.0006).toFixed(7) : null,
        gpsLng: nap ? (Number(nap.lng) + (rng() - 0.5) * 0.0006).toFixed(7) : null,
        idType: c.business ? "Business Permit" : pick(ID_TYPES),
        idNumber: c.business ? `BP-${digits(4)}-${digits(5)}` : `${digits(4)}-${digits(4)}-${digits(4)}`,
        notes: c.business ? "Official receipts addressed to the business name." : null,
        status: c.scenario === "terminated" ? "Inactive" : "Active",
        dateCreated: signedUpAt.format(DT),
        dateUpdated: signedUpAt.format(DT),
      });

      // ONU — seated on a NAP port unless the connection is still pending.
      let onuId = null;
      let mac = null;
      let onuIndex = null;
      let ponPortId = null;
      if (nap) {
        onuId = await uuid();
        ponSeq[nap.pon] += 1;
        onuIndex = `${nap.pon}/${ponSeq[nap.pon]}`;
        ponPortId = ponIds[`1/${nap.pon}`];
        const napPort = nap.nextPort++;
        mac = `E0:67:B3:${hex(2)}:${hex(2)}:${hex(2)}`;
        const cutOff = ["suspended", "suspended_long", "for_recovery"].includes(c.scenario);
        const recovered = c.scenario === "terminated";

        tally.onus += 1;
        await insert("onus", {
          onuId, companyId, branchId,
          serialNo: `HSGQ${hex(8)}`,
          mac,
          model: pick(ONU_MODELS),
          // A recovered modem is back in stock: off its NAP port, unprovisioned.
          napId: recovered ? null : nap.napId,
          napPort: recovered ? null : napPort,
          oltId: recovered ? null : oltId,
          ponPortId: recovered ? null : ponPortId,
          onuIndex: recovered ? null : onuIndex,
          provisioningState: recovered
            ? "unprovisioned"
            : cutOff ? "suspended" : c.onuOffline ? "offline" : "active",
          lastRxDbm: recovered ? null : c.weakSignal ? "-27.40" : (-17 - rng() * 6).toFixed(2),
          lastTxDbm: recovered ? null : (1.5 + rng() * 1.5).toFixed(2),
          lastSeenAt: recovered
            ? null
            : c.onuOffline
              ? now.clone().subtract(7, "hours").format(DT)
              : cutOff ? null : now.clone().subtract(randInt(2, 40), "minutes").format(DT),
          description: recovered ? "Recovered from terminated account; tested OK, in stock" : `${name} — ${nap.street}`,
          notes: c.weakSignal
            ? "Rx near sensitivity limit. Check drop cable splice at NAP."
            : c.onuOffline
              ? "No LOS light reported by customer; technician visit scheduled."
              : null,
          recordStatus: "Active",
          dateCreated: activatedAt.format(DT),
          dateUpdated: activatedAt.format(DT),
        });

        await logAction({
          onuId, action: "activate", triggeredBy: staffActor,
          command: ["configure", `interface epon ${nap.pon}`, `onu-authorize ${ponSeq[nap.pon]}`, "save"].join("\n"),
          deviceResponse: [`ONU ${onuIndex} authorization success`, `ONU ${onuIndex} link up`, "Configuration saved"].join("\n"),
          success: 1, durationMs: randInt(1800, 4200),
          dateCreated: activatedAt.clone().add(20, "minutes").format(DT),
        });
      }

      // ── Which months are billed, and what happened to each invoice ────
      const unpaidOffsets = new Set();
      let lastBilled = 0; // smallest offset that gets an invoice
      let suspendedAt = null;

      switch (c.scenario) {
        case "suspended":
          unpaidOffsets.add(pastDue);
          lastBilled = pastDue;
          break;
        case "exempt_current":
          unpaidOffsets.add(pastDue);
          break;
        case "exempt_two":
          unpaidOffsets.add(pastDue).add(pastDue + 1);
          break;
        case "suspended_long":
        case "for_recovery":
          unpaidOffsets.add(pastDue + c.unpaidAt);
          lastBilled = pastDue + c.unpaidAt;
          break;
        case "terminated":
          lastBilled = c.terminatedAt + 1;
          break;
        default:
      }
      if (["suspended", "suspended_long", "for_recovery"].includes(c.scenario)) {
        suspendedAt = dunningAt(periodAt(lastBilled).dueDate);
      }

      // Subscription
      const status = {
        suspended: "suspended",
        suspended_long: "suspended",
        for_recovery: "for_recovery",
        terminated: "terminated",
        pending: "pending",
      }[c.scenario] ?? "active";
      const forRecoveryAt =
        status === "for_recovery"
          ? moment.min(suspendedAt.clone().add(recoveryAfterDays + 1, "days").hour(9), now.clone().subtract(1, "day"))
          : null;
      const terminatedAt =
        status === "terminated" ? at(15, last.clone().subtract(c.terminatedAt, "months").date(10).format(D)) : null;

      const subscriptionId = await uuid();
      bump(tally.subscriptions, status);
      await insert("subscriptions", {
        subscriptionId, companyId, branchId, customerId, planId,
        onuId: status === "terminated" ? null : onuId,
        status,
        activatedAt: activatedAt?.format(DT),
        suspendedAt: suspendedAt?.format(DT),
        forRecoveryAt: forRecoveryAt?.format(DT),
        recoveryOutcome: status === "terminated" ? "recovered" : null,
        terminatedAt: terminatedAt?.format(DT),
        notes:
          status === "pending"
            ? `Installation scheduled ${now.clone().add(3, "days").format("MMM D")}, awaiting NAP port on ${NAPS[3].label}.`
            : status === "terminated"
              ? "Customer moved out of the service area. Modem recovered."
              : status === "for_recovery"
                ? "Unpaid past the recovery period. Technician to pull out modem."
                : null,
        recordStatus: "Active",
        dateCreated: signedUpAt.format(DT),
        dateUpdated: (terminatedAt ?? forRecoveryAt ?? suspendedAt ?? activatedAt ?? signedUpAt).format(DT),
      });

      if (suspendedAt) {
        // The first attempt timed out and the worker's retry landed — which is
        // what the action log screen is there to show.
        if (c.scenario === "suspended") {
          await logAction({
            onuId, action: "deactivate", triggeredBy: "system:dunning",
            command: ["configure", `interface epon ${onuIndex.split("/")[0]}`, `blacklist add mac ${mac}`, `onu-deregister ${onuIndex.split("/")[1]}`, "save"].join("\n"),
            deviceResponse: "% Connection timed out; no response from device",
            success: 0, error: "Device did not respond within 15000 ms", durationMs: 15000,
            dateCreated: suspendedAt.format(DT),
          });
        }
        await logAction({
          onuId, action: "deactivate", triggeredBy: "system:dunning",
          command: ["configure", `interface epon ${onuIndex.split("/")[0]}`, `blacklist add mac ${mac}`, `onu-deregister ${onuIndex.split("/")[1]}`, "save"].join("\n"),
          deviceResponse: [`MAC ${mac} added to blacklist`, `ONU ${onuIndex} deregistered`, "Configuration saved"].join("\n"),
          success: 1, durationMs: randInt(2100, 5200),
          dateCreated: suspendedAt.clone().add(c.scenario === "suspended" ? 6 : 0, "minutes").format(DT),
        });
        await emailEvent({
          customerId, type: "suspension", recipient: email,
          subject: "Your internet service has been suspended",
          dateCreated: suspendedAt.clone().add(3, "minutes").format(DT),
        });
      }

      if (c.onuOffline) {
        await logAction({
          onuId, action: "status", triggeredBy: staffActor,
          command: `show onu-info ${onuIndex}`,
          deviceResponse: `ONU ${onuIndex}  MAC ${mac}  State: offline  Last down cause: LOS`,
          success: 1, durationMs: randInt(900, 1600),
          dateCreated: now.clone().subtract(3, "hours").format(DT),
        });
      }

      if (!activatedAt) continue;

      // ── Adjustments ───────────────────────────────────────────────────
      const extrasFor = (k) => {
        const out = [];
        if (c.outageCredit && k === pastDue + 1) {
          const p = periodAt(k);
          out.push({
            kind: "credit",
            description: `Service credit — fibre cut on SPL-${code}-P1B, ${moment(p.periodStart).format("MMM")} 8–10`,
            amount: "-200.00",
          });
        }
        if (c.loyaltyDiscount && k === 0) {
          out.push({ kind: "discount", description: "Loyalty discount — 6 months on-time", amount: "-150.00" });
        }
        if (c.cableDebit && k === 1) {
          out.push({ kind: "debit", description: "Replacement drop cable after typhoon damage", amount: "350.00" });
        }
        return out;
      };

      // ── Invoices ──────────────────────────────────────────────────────
      const startOffset = c.act[0];
      let invoiceCount = 0;

      for (let k = startOffset; k >= lastBilled; k -= 1) {
        const period = periodAt(k);
        const serviceDays = serviceDaysInPeriod(
          activatedAt.format(DT), period.periodStart, period.periodEnd, period.daysInMonth
        );
        if (serviceDays <= 0) continue;

        const extras = extrasFor(k);
        const comp = buildInvoiceComputation({
          plan: { name: plan.name, monthlyPrice: plan.price, installFee: plan.install },
          daysInMonth: period.daysInMonth,
          serviceDays,
          includeInstallFee: invoiceCount === 0,
          vatRate,
          extraLines: extras,
        });
        invoiceCount += 1;

        const issuedAt = at(schedule.cycleHour ?? 9, period.statementDate);
        const invoiceId = await uuid();
        const invoiceNo = await allocateInvoiceNo(conn, companyId, period.year);

        // What happened to it.
        let outcome = unpaidOffsets.has(k) ? "unpaid" : "paid";
        if (c.voidAt === k) outcome = "void";
        if (c.lateAt === k) outcome = "late";

        let paidAt = null;
        if (outcome === "paid") {
          const window = Math.max(1, moment(period.dueDate).diff(moment(period.statementDate), "days"));
          paidAt = at(randInt(8, 20), moment(period.statementDate).add(randInt(1, window), "days").format(D));
          if (paidAt.isAfter(now)) outcome = "unpaid";
        } else if (outcome === "late") {
          paidAt = at(11, moment(period.dueDate).add(3, "days").format(D));
        }

        const invStatus =
          outcome === "void" ? "void"
            : paidAt ? "paid"
              : period.dueDate < today ? "overdue" : "issued";
        bump(tally.invoices, invStatus);

        await insert("invoices", {
          invoiceId, companyId, branchId, subscriptionId, customerId, invoiceNo,
          billingPeriodStart: period.periodStart,
          billingPeriodEnd: period.periodEnd,
          statementDate: period.statementDate,
          dueDate: period.dueDate,
          subtotal: comp.subtotal, fees: comp.fees, tax: comp.tax, total: comp.total,
          amountPaid: paidAt ? comp.total : "0.00",
          status: invStatus,
          publicToken: crypto.randomBytes(16).toString("hex"),
          issuedAt: issuedAt.format(DT),
          paidAt: paidAt?.format(DT),
          voidReason: outcome === "void" ? "Billed during a 5-day area outage — waived by management" : null,
          dateCreated: issuedAt.format(DT),
          dateUpdated: (paidAt ?? issuedAt).format(DT),
        });

        for (const [sortOrder, line] of comp.lines.entries()) {
          await insert("invoice_lines", {
            invoiceLineId: await uuid(), invoiceId, kind: line.kind, description: line.description,
            qty: line.qty, unitPrice: line.unitPrice, amount: line.amount, sortOrder,
            dateCreated: issuedAt.format(DT),
          });
        }

        // Adjustments carried onto this invoice, stamped as applied.
        for (const extra of extras) {
          tally.charges += 1;
          await insert("pending_charges", {
            pendingChargeId: await uuid(), companyId, branchId, customerId, subscriptionId,
            kind: extra.kind, description: extra.description, amount: extra.amount,
            appliedInvoiceId: invoiceId, appliedAt: issuedAt.format(DT), createdBy: staffId,
            status: "Active",
            dateCreated: issuedAt.clone().subtract(randInt(3, 12), "days").format(DT),
            dateUpdated: issuedAt.format(DT),
          });
        }

        await emailEvent({
          invoiceId, customerId, type: "invoice_issued", recipient: email,
          subject: `Your TERANETWORK bill ${invoiceNo}`,
          ...(c.emailBounced && k === startOffset - 1
            ? { providerStatus: "failed", providerMsgId: null, error: "550 5.1.1 Mailbox unavailable" }
            : {}),
          dateCreated: issuedAt.clone().add(12, "minutes").format(DT),
        });

        if (invStatus === "overdue" || outcome === "late") {
          await emailEvent({
            invoiceId, customerId, type: "reminder", recipient: email,
            subject: `Reminder: ${invoiceNo} is due soon`,
            dateCreated: at(9, moment(period.dueDate).subtract(schedule.reminderDaysBefore ?? 2, "days").format(D)).format(DT),
          });
          await emailEvent({
            invoiceId, customerId, type: "final", recipient: email,
            subject: `Final notice: ${invoiceNo} is due today`,
            dateCreated: at(7, period.dueDate).format(DT),
          });
        }

        if (paidAt) {
          const cash = c.cash || outcome === "late";
          tally.payments += 1;
          await insert("payments", {
            paymentId: await uuid(), companyId, branchId, invoiceId, customerId,
            amount: comp.total,
            channel: cash ? "CASH" : "GCASH",
            provider: null,
            providerPaymentId: null,
            recordedBy: staffId,
            paidAt: paidAt.format(DT),
            notes: cash ? "Paid at the branch office" : `GCash ref ${digits(4)} ${digits(3)} ${digits(6)}`,
            dateCreated: paidAt.clone().add(randInt(5, 90), "minutes").format(DT),
          });
          await emailEvent({
            invoiceId, customerId, type: "payment_received", recipient: email,
            subject: `Payment received for ${invoiceNo}`,
            dateCreated: paidAt.clone().add(randInt(95, 120), "minutes").format(DT),
          });
        }

        // A late payer was cut off on the due date and restored when they paid.
        if (outcome === "late" && onuId) {
          const cut = dunningAt(period.dueDate);
          const [pon, idx] = onuIndex.split("/");
          await logAction({
            onuId, action: "deactivate", triggeredBy: "system:dunning",
            command: ["configure", `interface epon ${pon}`, `blacklist add mac ${mac}`, `onu-deregister ${idx}`, "save"].join("\n"),
            deviceResponse: [`MAC ${mac} added to blacklist`, `ONU ${onuIndex} deregistered`, "Configuration saved"].join("\n"),
            success: 1, durationMs: randInt(2100, 5200), dateCreated: cut.format(DT),
          });
          await logAction({
            onuId, action: "activate", triggeredBy: "system:payment",
            command: ["configure", `interface epon ${pon}`, `blacklist del mac ${mac}`, `onu-authorize ${idx}`, "save"].join("\n"),
            deviceResponse: [`MAC ${mac} removed from blacklist`, `ONU ${onuIndex} authorization success`, `ONU ${onuIndex} link up`, "Configuration saved"].join("\n"),
            success: 1, durationMs: randInt(2100, 5200),
            dateCreated: paidAt.clone().add(4, "minutes").format(DT),
          });
          await emailEvent({
            invoiceId, customerId, type: "suspension", recipient: email,
            subject: "Your internet service has been suspended",
            dateCreated: cut.clone().add(3, "minutes").format(DT),
          });
          await emailEvent({
            invoiceId, customerId, type: "reconnection", recipient: email,
            subject: "Your internet service has been restored",
            dateCreated: paidAt.clone().add(7, "minutes").format(DT),
          });
        }
      }

      // ── Charges still waiting for the next invoice ────────────────────
      const pending = [];
      if (c.pendingCredit) pending.push({ kind: "credit", description: "Goodwill credit — slow speed ticket", amount: "-150.00" });
      if (c.pendingDebit) pending.push({ kind: "debit", description: "ONU replacement — water damage", amount: "500.00" });
      for (const p of pending) {
        tally.charges += 1;
        const created = now.clone().subtract(randInt(2, 9), "days").hour(13).format(DT);
        await insert("pending_charges", {
          pendingChargeId: await uuid(), companyId, branchId, customerId, subscriptionId,
          kind: p.kind, description: p.description, amount: p.amount,
          createdBy: staffId, status: "Active", dateCreated: created, dateUpdated: created,
        });
      }

      // ── Dunning exemptions ────────────────────────────────────────────
      const exemption = async (row) => {
        tally.exemptions += 1;
        await insert("dunning_exemptions", {
          exemptionId: await uuid(), companyId, branchId, subscriptionId, createdBy: staffId,
          status: "Active", ...row,
        });
      };
      if (c.scenario === "exempt_current") {
        const created = at(16, moment(periodAt(pastDue).dueDate).subtract(1, "day").format(D));
        await exemption({
          reason: `Promised to pay on ${now.clone().add(5, "days").format("MMM D")} — salary delayed`,
          expiresAt: now.clone().add(6, "days").endOf("day").format(DT),
          dateCreated: created.format(DT), dateUpdated: created.format(DT),
        });
      }
      if (c.scenario === "exempt_two") {
        const created = at(10, moment(periodAt(pastDue + 1).dueDate).subtract(1, "day").format(D));
        await exemption({
          reason: "Government account — payment follows the barangay's 30-day purchase-order cycle",
          expiresAt: now.clone().add(14, "days").endOf("day").format(DT),
          dateCreated: created.format(DT), dateUpdated: now.clone().subtract(1, "day").format(DT),
        });
      }
      if (c.revokedExemption) {
        const due = moment(periodAt(pastDue + 2).dueDate);
        const created = at(15, due.clone().subtract(2, "days").format(D));
        const revoked = at(10, due.clone().subtract(1, "day").format(D));
        await exemption({
          reason: "Hospitalised — family asked for a week's grace",
          expiresAt: due.clone().add(7, "days").endOf("day").format(DT),
          revokedBy: staffId, revokedAt: revoked.format(DT),
          revokeReason: "Paid before the due date — no longer needed",
          status: "Revoked",
          dateCreated: created.format(DT), dateUpdated: revoked.format(DT),
        });
      }
    }

    // ── Two modems in stock, never seated ───────────────────────────────
    for (let s = 0; s < 2; s += 1) {
      tally.onus += 1;
      await insert("onus", {
        onuId: await uuid(), companyId, branchId,
        serialNo: `HSGQ${hex(8)}`, mac: `E0:67:B3:${hex(2)}:${hex(2)}:${hex(2)}`,
        model: ONU_MODELS[0], provisioningState: "unprovisioned",
        description: "New unit in stock", recordStatus: "Active",
        dateCreated: stamp, dateUpdated: stamp,
      });
    }

    await conn.commit();

    // ── Summary ───────────────────────────────────────────────────────────
    const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(" · ");
    console.log(`\n🌱 Seeded branch "${branch.name}" (dates relative to ${today})`);
    console.log(`   plans          ${Object.keys(PLANS).length}`);
    console.log(`   network        2 OLTs · ${ports.length} PON ports · 5 splitters · ${NAPS.length} NAPs · ${tally.onus} ONUs`);
    console.log(`   customers      ${CUSTOMERS.length}`);
    console.log(`   subscriptions  ${fmt(tally.subscriptions)}`);
    console.log(`   invoices       ${fmt(tally.invoices)}`);
    console.log(`   payments       ${tally.payments}`);
    console.log(`   adjustments    ${tally.charges}`);
    console.log(`   exemptions     ${tally.exemptions}`);
    console.log(`   email events   ${tally.emails}`);
    console.log(`   action logs    ${tally.logs}`);
    console.log("\n   No jobs were queued. OLTs use the mock driver on TEST-NET addresses.");
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* nothing was started */
    }
    console.error("\n❌ Seeding failed:", err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
