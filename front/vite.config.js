import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [react(), tailwindcss()],
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
            "antd-vendor": ["antd", "@ant-design/icons"],
            "query-vendor": ["@tanstack/react-query"],
            "utils-vendor": ["axios", "dayjs", "zustand"],
          },
        },
      },
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Source maps for production debugging
      sourcemap: mode === "development",
    },
    optimizeDeps: {
      // Pre-bundle dependencies for faster dev server
      include: [
        "react",
        "react-dom",
        "react-router",
        "antd",
        "@ant-design/icons",
        "@tanstack/react-query",
        "axios",
        "dayjs",
        "zustand",
        "clsx",
      ],
    },
  };
});
