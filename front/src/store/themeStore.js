import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "ui-theme";

/** Reflect the active mode onto <html> so CSS `.dark` overrides apply. */
const applyClass = (mode) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
};

/** First-load default: honour the OS preference. Persisted value wins after. */
const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export const useThemeStore = create(
  persist(
    (set, get) => ({
      mode: systemPrefersDark() ? "dark" : "light",

      setMode: (mode) => {
        applyClass(mode);
        set({ mode });
      },

      toggle: () => {
        const next = get().mode === "dark" ? "light" : "dark";
        applyClass(next);
        set({ mode: next });
      },
    }),
    {
      name: STORAGE_KEY,
      // Re-sync the <html> class once the persisted value is rehydrated.
      onRehydrateStorage: () => (state) => {
        if (state) applyClass(state.mode);
      },
    },
  ),
);
