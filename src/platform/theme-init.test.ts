import { describe, expect, it } from "vitest";
import script from "../../public/theme-init.js?raw";
import { mediaMatches } from "../test-setup.ts";
import { resolveTheme, SETTINGS_KEY, type ThemePreference } from "./settings.ts";

function runInit(): string | undefined {
  delete document.documentElement.dataset.theme;
  new Function(script)();
  return document.documentElement.dataset.theme;
}

describe("theme-init.js", () => {
  const cases: { saved: ThemePreference | null; prefersDark: boolean }[] = [
    { saved: null, prefersDark: false },
    { saved: null, prefersDark: true },
    { saved: "system", prefersDark: true },
    { saved: "light", prefersDark: true },
    { saved: "dark", prefersDark: false },
  ];

  it.each(cases)("AC-U9 matches resolveTheme for %o", ({ saved, prefersDark }) => {
    mediaMatches.set("(prefers-color-scheme: dark)", prefersDark);
    if (saved) localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: saved }));
    expect(runInit()).toBe(resolveTheme(saved ?? "system", prefersDark));
  });

  it("AC-U9 falls back to the system when the saved settings are broken", () => {
    mediaMatches.set("(prefers-color-scheme: dark)", true);
    localStorage.setItem(SETTINGS_KEY, "{broken");
    expect(runInit()).toBe("dark");
  });
});
