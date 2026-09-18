import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const isAnalyze = mode === "analyze";
  // Two apps from one codebase (docs/decisions.md D10):
  //   default          the branch app (Admin portal) — deployed on every branch PC
  //   --mode superadmin the central SuperAdmin app — deployed on the developer's PC only
  // The route tree is swapped at the module level, so the other app's pages are
  // never imported and never end up in the bundle.
  const isSuperAdminApp = mode === "superadmin";

  return {
    plugins: [
      react(),
      tailwindcss(),
      // `npm run build:analyze` → writes dist/stats.html and opens it
      isAnalyze &&
        visualizer({
          filename: "dist/stats.html",
          open: true,
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        // shadcn/ui components import via `@/…`; also usable in app code.
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@app-routes": fileURLToPath(
          new URL(
            isSuperAdminApp ? "./src/routes/superadmin.jsx" : "./src/routes/index.jsx",
            import.meta.url
          )
        ),
      },
    },
    server: {
      host: true,
      port: isSuperAdminApp ? 5175 : 5173,
      proxy: isSuperAdminApp
        ? {
            // superadmin-server; its API lives under /api (no /v1).
            "/api": {
              target: env.VITE_SUPERADMIN_API_URL || "http://localhost:8788",
              changeOrigin: true,
              secure: false,
            },
          }
        : {
        "/api/v1": {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
        "/public/uploads": {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: isSuperAdminApp ? "dist-superadmin" : "dist",
      // Enable code splitting
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks for better caching
            "react-vendor": ["react", "react-dom", "react-router"],
            "query-vendor": ["@tanstack/react-query"],
            "utils-vendor": ["axios", "dayjs", "zustand"],
          },
        },
      },
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
      // "hidden" emits .map files WITHOUT the //# sourceMappingURL comment, so
      // production stack traces are resolvable after uploading the maps to
      // Sentry, but the maps are never advertised to (or fetched by) browsers.
      // Upload dist/**/*.map to Sentry in CI, then delete them before serving.
      sourcemap: mode === "development" ? true : "hidden",
    },
    optimizeDeps: {
      // Pre-bundle dependencies for faster dev server
      include: [
        "react",
        "react-dom",
        "react-router",
        "@tanstack/react-query",
        "axios",
        "dayjs",
        "zustand",
        "clsx",
      ],
    },
  };
});
