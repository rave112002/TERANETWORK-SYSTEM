import fs from "node:fs";
import path from "node:path";

import express from "express";

import { createAuth, requireClientHeader } from "./auth.js";
import { createBranchesRouter } from "./branches.js";
import { fail } from "./respond.js";

/**
 * The SuperAdmin server: its API under /api, and in production the built
 * SuperAdmin web app (front, `npm run build:superadmin`) from the same origin.
 *
 * @param {{db: import('node:sqlite').DatabaseSync, config: object, fetchImpl?: typeof fetch}} deps
 */
export const createApp = ({ db, config, fetchImpl }) => {
  const app = express();
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use(express.json({ limit: "100kb" }));

  const auth = createAuth({ db, config });
  const api = express.Router();
  api.use(requireClientHeader);
  api.use("/auth", auth.router);
  api.use("/branches", auth.requireSession, createBranchesRouter({ db, config, fetchImpl }));
  api.use((req, res) => fail(res, 404, "Not found"));
  app.use("/api", api);

  // The web app, when it has been built. Unknown paths get index.html so the
  // app's own router can handle /superadmin/branches on a reload.
  const indexHtml = path.join(config.webDist, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.webDist, { index: false }));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(indexHtml));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === "entity.parse.failed") return fail(res, 400, "The request body is not valid JSON");
    console.error("[superadmin]", err);
    return fail(res, 500, "Something went wrong", "INTERNAL_ERROR");
  });

  return app;
};

export default { createApp };
