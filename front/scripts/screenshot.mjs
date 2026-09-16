/**
 * Screenshot every admin screen, and report what the browser complained about.
 *
 *   npm run shoot
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Lint and `vite build` prove a page compiles. They cannot tell you the map
 * tiles are stamped "API KEY REQUIRED", that a placeholder is clipped, or that
 * a route 404s because it is registered under the wrong path. Every one of
 * those shipped in this repo until somebody looked at a picture of the page.
 *
 * It drives the Chrome already installed on the machine through
 * `playwright-core`, so there is no 300MB browser download.
 *
 * ── Before running ──────────────────────────────────────────────────────────
 *
 *   1. the API on :3100      cd back  && PORT=3100 npm start
 *   2. this app on :5173     VITE_API_URL=http://localhost:3100 npm run dev
 *   3. data worth looking at — empty tables hide almost every layout problem
 *      there is, so seed a few customers, invoices and NAPs first.
 *   4. an admin to log in as, passed in rather than written down here:
 *      SHOT_EMAIL=you@example.com SHOT_PASSWORD=... npm run shoot
 *
 * Shots land in `front/shots/` (git-ignored). The console/network capture at
 * the end matters as much as the images: a page can look right and still fire
 * a 400 on every keystroke.
 */

import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import path from "node:path";

const APP = process.env.APP || "http://localhost:5173";
const OUT = process.env.OUT || "./shots";
/** Comma-separated page names to shoot; empty means all of them. */
const ONLY = (process.env.ONLY || "").split(",").map((n) => n.trim()).filter(Boolean);
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const ADMIN = {
  email: process.env.SHOT_EMAIL,
  password: process.env.SHOT_PASSWORD,
};

if (!ADMIN.email || !ADMIN.password) {
  console.error(
    [
      "Set SHOT_EMAIL and SHOT_PASSWORD to an admin account on the API this run",
      "points at. They are deliberately not kept in this file — a password",
      "committed here is a password published.",
      "",
      "  SHOT_EMAIL=admin@example.com SHOT_PASSWORD=... npm run shoot",
    ].join("\n")
  );
  process.exit(1);
}

/** Only pages worth a look. Drawers are opened by `action`. */
const PAGES = [
  { name: "01-dashboard", path: "/admin/dashboard" },
  { name: "02-customers", path: "/admin/subscribers/customers" },
  { name: "03-plans", path: "/admin/subscribers/plans" },
  { name: "04-subscriptions", path: "/admin/subscribers/subscriptions" },
  { name: "04b-recovery", path: "/admin/subscribers/recovery" },
  { name: "05-invoices", path: "/admin/billing/invoices" },
  { name: "06-payments", path: "/admin/billing/payments" },
  { name: "07-adjustments", path: "/admin/billing/adjustments" },
  { name: "08-dunning", path: "/admin/billing/dunning" },
  { name: "09-topology", path: "/admin/network/topology" },
  { name: "10-olts", path: "/admin/network/olts" },
  { name: "11-pon-ports", path: "/admin/network/pon-ports" },
  { name: "12-splitters", path: "/admin/network/splitters" },
  { name: "13-naps", path: "/admin/network/naps" },
  { name: "14-onus", path: "/admin/network/onus" },
  { name: "15-discovery", path: "/admin/network/discovery" },
  { name: "16-system", path: "/admin/system" },
  { name: "17-users", path: "/admin/user-management/users" },
  { name: "18-roles", path: "/admin/user-management/roles" },
  { name: "19-audit-trail", path: "/admin/audit-trail" },
  { name: "20-settings", path: "/admin/settings" },
];

/** Drawers and forms, reached by clicking. */
const DRAWERS = [
  {
    name: "30-drawer-customer-form",
    path: "/admin/subscribers/customers",
    click: "button:has-text('Add Customer')",
  },
  { name: "31-drawer-plan-form", path: "/admin/subscribers/plans", click: "button:has-text('Create Plan')" },
  {
    name: "32-drawer-subscription-form",
    path: "/admin/subscribers/subscriptions",
    click: "button:has-text('New Subscription')",
  },
  { name: "33-drawer-olt-form", path: "/admin/network/olts", click: "button:has-text('Add OLT')" },
  { name: "34-drawer-onu-form", path: "/admin/network/onus", click: "button:has-text('Add ONU')" },
  {
    name: "35-drawer-adjustment-form",
    path: "/admin/billing/adjustments",
    click: "button:has-text('Add adjustment')",
  },
  { name: "36-drawer-run-billing", path: "/admin/billing/invoices", click: "button:has-text('Run billing')" },
  { name: "37-drawer-sweep", path: "/admin/billing/dunning", click: "button:has-text('Run sweep')" },
  {
    name: "38-drawer-discovery-sweep",
    path: "/admin/network/discovery",
    click: "button:has-text('Sweep an OLT')",
  },
];

const problems = [];

const run = async () => {
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Everything the page complains about, attributed to whatever it was doing
  // at the time.
  let current = "startup";
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const text = msg.text();
    // React DevTools nag and Vite's HMR chatter are not findings.
    if (/React DevTools|\[vite\]/i.test(text)) return;
    problems.push({ page: current, kind: `console.${msg.type()}`, text: text.slice(0, 300) });
  });
  page.on("pageerror", (err) => {
    problems.push({ page: current, kind: "pageerror", text: String(err.message).slice(0, 300) });
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      problems.push({
        page: current,
        kind: `http.${res.status()}`,
        text: `${res.request().method()} ${res.url().replace(APP, "")}`,
      });
    }
  });

  // ── Log in ────────────────────────────────────────────────────────
  current = "login";
  await page.goto(`${APP}/admin/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "00-login.png"), fullPage: true });

  await page.fill('input[type="email"], input[name="email"]', ADMIN.email);
  await page.fill('input[type="password"], input[name="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/(dashboard|)/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  if (page.url().includes("/login")) {
    console.error("Login did not navigate away. Still at", page.url());
    await page.screenshot({ path: path.join(OUT, "00-login-FAILED.png"), fullPage: true });
    await browser.close();
    process.exit(1);
  }
  // `waitForURL` above resolves on any /admin/* URL, and a failed login can
  // leave the app on one of those for a moment before it bounces back. Proving
  // the session by loading a real page is the only check worth printing.
  await page.goto(`${APP}/admin/dashboard`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);
  if (page.url().includes("/login")) {
    console.error(
      "Login did not take. Most often this is the auth rate limiter after " +
        "repeated runs — restart the API and try again."
    );
    await page.screenshot({ path: path.join(OUT, "00-login-FAILED.png"), fullPage: true });
    await browser.close();
    process.exit(1);
  }
  console.log("✓ logged in");

  // ── Pages ─────────────────────────────────────────────────────────
  for (const spec of PAGES) {
    if (ONLY.length > 0 && !ONLY.some((n) => spec.name.includes(n))) continue;
    current = spec.name;
    try {
      await page.goto(`${APP}${spec.path}`, { waitUntil: "networkidle", timeout: 20000 });
      // Give tables, charts and the map a moment to settle.
      await page.waitForTimeout(1200);

      // Landing back on the login page means the session went away — an expired
      // token, a rate-limited login that only looked successful. Without this
      // check the run reports a tick for every page and every shot is a picture
      // of the login screen, which is worse than a failure because it looks
      // like a pass.
      if (page.url().includes("/login")) {
        problems.push({
          page: spec.name,
          kind: "auth",
          text: "redirected to the login page — the session is gone, and every shot after this one is worthless",
        });
        console.log(`  ✗ ${spec.name}: not logged in`);
        continue;
      }

      await page.screenshot({ path: path.join(OUT, `${spec.name}.png`), fullPage: true });
      console.log(`  ✓ ${spec.name}`);
    } catch (err) {
      problems.push({ page: spec.name, kind: "navigation", text: err.message.slice(0, 200) });
      console.log(`  ✗ ${spec.name}: ${err.message.slice(0, 120)}`);
    }
  }

  // ── Drawers ───────────────────────────────────────────────────────
  for (const spec of DRAWERS) {
    if (ONLY.length > 0 && !ONLY.some((n) => spec.name.includes(n))) continue;
    current = spec.name;
    try {
      await page.goto(`${APP}${spec.path}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(900);

      const button = page.locator(spec.click).first();
      if ((await button.count()) === 0) {
        problems.push({ page: spec.name, kind: "missing", text: `no button matching ${spec.click}` });
        console.log(`  ? ${spec.name}: button not found`);
        continue;
      }

      await button.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT, `${spec.name}.png`), fullPage: true });
      console.log(`  ✓ ${spec.name}`);
    } catch (err) {
      problems.push({ page: spec.name, kind: "interaction", text: err.message.slice(0, 200) });
      console.log(`  ✗ ${spec.name}: ${err.message.slice(0, 120)}`);
    }
  }

  // ── A narrow viewport, because these get used on phones ───────────
  await page.setViewportSize({ width: 390, height: 844 });
  for (const spec of [
    { name: "40-mobile-invoices", path: "/admin/billing/invoices" },
    { name: "41-mobile-dunning", path: "/admin/billing/dunning" },
    { name: "42-mobile-customers", path: "/admin/subscribers/customers" },
  ]) {
    current = spec.name;
    try {
      await page.goto(`${APP}${spec.path}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT, `${spec.name}.png`), fullPage: true });
      console.log(`  ✓ ${spec.name}`);
    } catch (err) {
      problems.push({ page: spec.name, kind: "navigation", text: err.message.slice(0, 200) });
    }
  }

  await browser.close();

  // ── Report ────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(64)}`);
  if (problems.length === 0) {
    console.log(" No console errors, page errors or failed requests.");
  } else {
    console.log(` ${problems.length} problem(s) the browser reported:\n`);
    const byPage = new Map();
    for (const p of problems) {
      if (!byPage.has(p.page)) byPage.set(p.page, []);
      byPage.get(p.page).push(p);
    }
    for (const [pageName, list] of byPage) {
      console.log(`  ${pageName}`);
      // Collapse repeats — one warning fired forty times is one finding.
      const seen = new Map();
      for (const p of list) {
        const key = `${p.kind}|${p.text}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      for (const [key, count] of seen) {
        const [kind, text] = key.split("|");
        console.log(`    [${kind}]${count > 1 ? ` ×${count}` : ""} ${text}`);
      }
    }
  }
  console.log(`${"═".repeat(64)}\n`);

  await fs.writeFile(path.join(OUT, "problems.json"), JSON.stringify(problems, null, 2));
};

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
