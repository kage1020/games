import { useEffect } from "react";
import { useMediaQuery } from "./media.ts";
import { resolveTheme, settingsStore, type Theme } from "./settings.ts";
import { useStore } from "./store.ts";

const PREFERS_DARK = "(prefers-color-scheme: dark)";

export function useResolvedTheme(): Theme {
  const { theme } = useStore(settingsStore);
  const prefersDark = useMediaQuery(PREFERS_DARK);
  return resolveTheme(theme, prefersDark);
}

/** <html data-theme> をいまのテーマにそろえる */
export function useApplyTheme(): Theme {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return theme;
}

export function toggleTheme(current: Theme): void {
  settingsStore.set((settings) => ({ ...settings, theme: current === "dark" ? "light" : "dark" }));
}
