import path from "node:path";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";

const config = loadConfig();
const db = openDatabase(path.join(config.dataDir, "superadmin.db"));
const app = createApp({ db, config });

const userCount = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE status = 'Active'`).get().n;

app.listen(config.port, config.host, () => {
  console.log(`SuperAdmin server on http://${config.host}:${config.port}`);
  if (userCount === 0) {
    console.log("No SuperAdmin login exists yet. Create one with:  npm run user -- --username <name>");
  }
});
