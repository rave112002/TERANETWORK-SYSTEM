import { useEffect, useMemo, useState } from "react";
import { useThemeStore } from "../../store/themeStore";

const TOKENS = {
  series: "--chart-series-1",
  grid: "--color-line",
  axis: "--color-text-muted",
  surface: "--color-surface",
  line: "--color-line",
  text: "--color-text-dark",
  textSecondary: "--color-text-secondary",
};

const readTokens = () => {
  if (typeof document === "undefined") return {};
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(TOKENS).map(([key, cssVar]) => [
      key,
      styles.getPropertyValue(cssVar).trim(),
    ]),
  );
};

/**
 * Resolve the design-system chart tokens to concrete colours.
 *
 * Recharts sets colours as SVG attributes, where `var(--x)` is unreliable, so we
 * read the computed values instead — and re-read whenever the theme flips, which
 * keeps the charts in sync with light/dark without duplicating the palette here.
 */
export const useChartTheme = () => {
  const mode = useThemeStore((s) => s.mode);
  const [tokens, setTokens] = useState(readTokens);

  useEffect(() => {
    // Read after the .dark class has been applied to <html> for this mode
    const id = requestAnimationFrame(() => setTokens(readTokens()));
    return () => cancelAnimationFrame(id);
  }, [mode]);

  return useMemo(
    () => ({
      ...tokens,
      // Respect the user's motion preference (charts animate on mount by default)
      animate:
        typeof window !== "undefined" &&
        !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    }),
    [tokens],
  );
};
