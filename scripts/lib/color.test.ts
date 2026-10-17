import { describe, expect, it } from "vitest";
import { resolveThemeColors, toHex } from "./color.ts";
import type { Tokens } from "./tokens-to-css.ts";

describe("toHex", () => {
  it("passes hex through and drops alpha into the 8-digit form", () => {
    expect(toHex("#2d70b3")).toBe("#2d70b3");
    expect(toHex("#ffffff1a")).toBe("#ffffff1a");
  });

  it("converts oklch to sRGB hex", () => {
    expect(toHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(toHex("oklch(0 0 0)")).toBe("#000000");
    expect(toHex("oklch(0.145 0 0)")).toBe("#0a0a0a");
    expect(toHex("oklch(0.577 0.245 27.325)")).toBe("#e7000b");
  });
});

describe("resolveThemeColors", () => {
  it("resolves a theme's colors and aliases to hex", () => {
    const tokens = {
      name: "t",
      version: 1,
      color: {
        themes: [
          { id: "light", name: "Light" },
          { id: "dark", name: "Dark" },
        ],
        tokens: [
          { name: "bg", value: { light: "oklch(1 0 0)", dark: "oklch(0 0 0)" } },
          { name: "accent", value: "#2d70b3" },
          { name: "focus", value: "{accent}" },
        ],
      },
      type: { fonts: [], families: {}, groups: [] },
    } satisfies Tokens;
    expect(resolveThemeColors(tokens, "light")).toEqual({
      bg: "#ffffff",
      accent: "#2d70b3",
      focus: "#2d70b3",
    });
    expect(resolveThemeColors(tokens, "dark").bg).toBe("#000000");
  });
});
