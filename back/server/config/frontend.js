import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { logger } from "./logger.js";

/**
 * Serve the built Admin portal (front/dist) from this same Express process.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * A branch PC runs ONE process on ONE port (docs/isp-invoice-generator-
 * deployment-multibranch.md, "Application Serving"): staff open
 * http://localhost:8787 and get both the screens and the API. The client calls
 * the API with relative `/api/v1/...` paths, so same origin means no CORS and
 * no API address baked into the build.
 *
 * In development nothing changes: Vite serves the screens on :5173 and proxies
 * `/api/v1` here. If no build exists this does nothing at all.
 *
 * FRONTEND_DIST points at the build folder; relative paths resolve from the
 * working directory. Default: `front/dist` next to `back/`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = path.resolve(here, "../../../front/dist");

// Anything under these belongs to the API; an unknown path there must stay a
// JSON 404, never the app's HTML.
const API_PATHS = /^\/(api|public|health)(\/|$)/;

export function serveFrontend(app) {
  const dist = process.env.FRONTEND_DIST ? path.resolve(process.env.FRONTEND_DIST) : DEFAULT_DIST;
  const indexHtml = path.join(dist, "index.html");

  if (!fs.existsSync(indexHtml)) {
    logger.info(`Frontend build not found at ${dist} — serving the API only`);
    return;
  }
  logger.info(`Serving the frontend build from ${dist}`);

  // Source maps are built "hidden" for Sentry and are not for browsers.
  app.use((req, res, next) => (req.path.endsWith(".map") ? res.status(404).end() : next()));

  app.use(
    express.static(dist, {
      index: false,
      setHeaders(res, filePath) {
        // Vite fingerprints everything in assets/, so a changed file gets a new
        // name and the old one can be cached for good.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // Client-side routes (/customers, /billing/invoices, …) all load index.html
  // and React Router takes it from there. Never cached, so a new build is
  // picked up on the next page load.
  app.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) || API_PATHS.test(req.path)) return next();
    if (!req.accepts("html")) return next();
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(indexHtml);
  });
}
