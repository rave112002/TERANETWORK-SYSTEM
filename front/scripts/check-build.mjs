/**
 * After a build, prove the right app went into the right folder.
 *
 *   node scripts/check-build.mjs branch       dist/            must NOT contain the SuperAdmin app
 *   node scripts/check-build.mjs superadmin   dist-superadmin/ MUST contain it
 *
 * The branch build is what gets installed on every branch PC, so a SuperAdmin
 * page leaking into it would put the central management tool on machines
 * branch staff use (docs/decisions.md D10). This fails the build if it happens.
 */
import fs from "node:fs";
import path from "node:path";

const MARKER = "teranetwork-superadmin-console"; // routes/superadmin.jsx BUILD_MARKER
const target = process.argv[2];
const dir = target === "superadmin" ? "dist-superadmin" : "dist";

const jsFiles = (folder) =>
  fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });

if (!fs.existsSync(dir)) {
  console.error(`check-build: ${dir}/ does not exist`);
  process.exit(1);
}

const sources = jsFiles(dir).map((file) => fs.readFileSync(file, "utf8"));
const found = sources.some((code) => code.includes(MARKER));

// The old in-branch SuperAdmin portal was removed (D10). Its API is gone from the
// branch server, so any code still calling it is dead weight or a regression.
const OLD_PORTAL_API = "/api/v1/superadmin";
if (target !== "superadmin" && sources.some((code) => code.includes(OLD_PORTAL_API))) {
  console.error(`check-build: the BRANCH build still calls ${OLD_PORTAL_API}, which no longer exists.`);
  process.exit(1);
}

if (target === "superadmin" && !found) {
  console.error("check-build: the SuperAdmin build does not contain the SuperAdmin app");
  process.exit(1);
}
if (target !== "superadmin" && found) {
  console.error("check-build: the BRANCH build contains the central SuperAdmin app. It must not.");
  process.exit(1);
}
console.log(`check-build: ${dir}/ OK (${target === "superadmin" ? "SuperAdmin app" : "branch app, no SuperAdmin console"})`);
