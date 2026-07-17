import { theme as antdAlgorithm } from "antd";

/**
 * Accent — green. Keep in sync with `--color-secondary-color` / `--color-primary`
 * in `src/index.css`. Ant Design needs a JS value (it can't read CSS variables),
 * so the accent lives here as well as in the stylesheet.
 *
 * Note: the accent is used sparingly (focus rings, ticks, chips) — NOT on
 * buttons. Primary buttons are inverted monochrome via the `.ant-btn-primary`
 * override in index.css.
 */
export const COMPANY_PRIMARY = "#22c55e";

const FONT_SANS =
  '"Onest Variable", "Onest", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

// Palette mirrors the semantic surface/text tokens in index.css so Ant
// components (Table, Drawer, Modal, Dropdown, Input…) match our shell exactly.
const PALETTE = {
  light: {
    canvas: "#f5f5f6",
    surface: "#ffffff",
    surfaceSunken: "#f4f4f5",
    border: "#e4e4e7",
    borderLight: "#f4f4f5",
    text: "#18181b",
    textSecondary: "#52525b",
    rowHover: "#f4f4f5",
  },
  dark: {
    canvas: "#09090b",
    surface: "#0f0f12",
    surfaceSunken: "#18181b",
    border: "#27272a",
    borderLight: "#1c1c20",
    text: "#f4f4f5",
    textSecondary: "#a1a1aa",
    rowHover: "#18181b",
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
      colorPrimary: COMPANY_PRIMARY,
      colorInfo: COMPANY_PRIMARY,
      colorSuccess: "#22c55e",
      colorWarning: "#f59e0b",
      colorError: "#ef4444",
      fontFamily: FONT_SANS,
      borderRadius: 9, // --radius-control
      colorBgLayout: p.canvas,
      colorBgContainer: p.surface,
      colorBgElevated: isDark ? "#18181b" : p.surface,
      colorBorder: p.border,
      colorBorderSecondary: p.borderLight,
      colorText: p.text,
      colorTextSecondary: p.textSecondary,
      boxShadow: "none",
      boxShadowSecondary: isDark
        ? "0 8px 24px rgba(0,0,0,.55)"
        : "0 8px 24px rgba(0,0,0,.10)",
    },
    components: {
      Table: {
        headerBg: p.surface,
        headerColor: p.textSecondary,
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
        colorBgSpotlight: isDark ? "#27272a" : "#18181b",
      },
    },
  };
};
