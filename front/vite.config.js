import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const isAnalyze = mode === "analyze";

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
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
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
