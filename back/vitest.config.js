import { defineConfig } from "vitest/config";

/**
 * Unit tests only — no database, no network, no running server.
 *
 * The suites that matter here (money, billing dates, invoice maths, webhook
 * settlement, the dunning sweep) are pure functions or run against a fake `db`,
 * so the whole thing finishes in seconds and can run on every save. Anything
 * needing a real MySQL belongs in a separate integration run, not here.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.js"],
    // Long enough for a slow CI machine, short enough that a hung test fails
    // fast rather than stalling the suite.
    testTimeout: 10000,
  },
});
