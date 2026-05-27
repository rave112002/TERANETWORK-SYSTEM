import { Tooltip } from "antd";
import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../store/themeStore";

/**
 * Light/dark switch. Reads + writes the persisted theme store, which also
 * toggles the `.dark` class on <html>. Drop it anywhere (topbar, settings…).
 */
const ThemeToggle = ({ size = 18 }) => {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = mode === "dark";

  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <button
        type="button"
        aria-label="Toggle color theme"
        aria-pressed={isDark}
        onClick={toggle}
        className="icon-btn w-9 h-9 shrink-0"
      >
        {isDark ? <Sun size={size} /> : <Moon size={size} />}
      </button>
    </Tooltip>
  );
};

export default ThemeToggle;
