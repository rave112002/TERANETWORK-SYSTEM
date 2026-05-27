import { theme as antdAlgorithm } from "antd";

/**
 * Brand primary. Keep in sync with `--color-primary` in `src/index.css`.
 * Ant Design needs a JS value (it can't read CSS variables), so the accent
 * lives here as well as in the stylesheet.
 */
export const BRAND_PRIMARY = "#4f46e5";

// Palette mirrors the semantic surface/text tokens in index.css so Ant
// components (Table, Drawer, Modal, Dropdown, Input…) match our shell exactly.
const PALETTE = {
  light: {
    canvas: "#f8fafc",
    surface: "#ffffff",
    surfaceSunken: "#f8fafc",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    text: "#0f172a",
    textSecondary: "#64748b",
    rowHover: "#eef2ff",
  },
  dark: {
    canvas: "#0f172a",
    surface: "#1e293b",
    surfaceSunken: "#172033",
    border: "#334155",
    borderLight: "#1e293b",
    text: "#f1f5f9",
    textSecondary: "#94a3b8",
    rowHover: "#243044",
  },
};

/**
 * Build an Ant Design theme config for the given mode ("light" | "dark").
 * Pass the result straight to <ConfigProvider theme={...}>.
 */
export const getAntdTheme = (mode = "light") => {
  const isDark = mode === "dark";
  const p = isDark ? PALETTE.dark : PALETTE.light;

  return {
    algorithm: isDark
      ? antdAlgorithm.darkAlgorithm
      : antdAlgorithm.defaultAlgorithm,
    token: {
      colorPrimary: BRAND_PRIMARY,
      colorInfo: BRAND_PRIMARY,
      colorSuccess: "#10b981",
      colorWarning: "#f59e0b",
      colorError: "#ef4444",
      fontFamily: "Poppins, sans-serif",
      borderRadius: 8,
      colorBgLayout: p.canvas,
      colorBgContainer: p.surface,
      colorBgElevated: p.surface,
      colorBorder: p.border,
      colorBorderSecondary: p.borderLight,
      colorText: p.text,
      colorTextSecondary: p.textSecondary,
    },
    components: {
      Table: {
        headerBg: p.surfaceSunken,
        headerColor: p.text,
        rowHoverBg: p.rowHover,
        borderColor: p.borderLight,
      },
      Card: {
        colorBgContainer: p.surface,
      },
      Drawer: {
        colorBgElevated: p.surface,
      },
      Modal: {
        contentBg: p.surface,
        headerBg: p.surface,
      },
      Tooltip: {
        colorBgSpotlight: isDark ? "#334155" : "#0f172a",
      },
    },
  };
};
