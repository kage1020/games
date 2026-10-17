import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Tokens, tokensToCss } from "./tokens-to-css.ts";

const fixture: Tokens = {
  name: "kage1020",
  version: 1,
  color: {
    themes: [
      { id: "light", name: "Light" },
      { id: "dark", name: "Dark" },
    ],
    tokens: [
      { name: "bg", value: { light: "#ffffff", dark: "#000000" } },
      { name: "accent", value: { light: "#2d70b3", dark: "#6ea8e6" } },
      { name: "same", value: { light: "#111111", dark: "#111111" } },
      { name: "only-light", value: "#222222" },
      { name: "focus", value: "{accent}" },
    ],
  },
  type: {
    fonts: [],
    families: { sans: "system-ui, sans-serif", mono: "ui-monospace, monospace" },
    groups: [
      {
        name: "Text",
        family: "sans",
        styles: [
          {
            name: "display",
            fontSize: "32px",
            lineHeight: "1.3",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          },
          { name: "ui", fontSize: "14px", lineHeight: "20px", fontWeight: 400 },
        ],
      },
      {
        name: "Code",
        family: "mono",
        styles: [{ name: "code", fontSize: "13px", lineHeight: "20px", fontWeight: 400 }],
      },
    ],
  },
  spacing: { tokens: [{ name: "space-1", value: "4px" }] },
  radius: { tokens: [{ name: "radius-md", value: "6px" }] },
  size: { tokens: [{ name: "icon", value: "16px" }] },
  shadow: { tokens: [{ name: "shadow-none", value: "none" }] },
  aspect: { tokens: [{ name: "aspect-wide", value: "16 / 9" }] },
  zIndex: { tokens: [{ name: "z-hud", value: "10" }] },
};

function block(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no block for ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css
    .slice(open + 1, close)
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean);
}

const light = ':root, [data-theme="light"]';
const dark = '[data-theme="dark"]';

describe("tokensToCss", () => {
  const css = tokensToCss(fixture);

  it("AC-T1 starts with the generated marker comment", () => {
    expect(css.split("\n")[0]).toBe("/* kage1020 — generated from tokens.json */");
  });

  it("AC-T2 declares first-theme colors on :root and the light theme", () => {
    expect(block(css, light)).toEqual(
      expect.arrayContaining(["--bg: #ffffff", "--accent: #2d70b3", "--only-light: #222222"]),
    );
  });

  it("AC-T3 re-declares only differing colors and every alias for later themes", () => {
    const declarations = block(css, dark);
    expect(declarations).toEqual(
      expect.arrayContaining(["--bg: #000000", "--accent: #6ea8e6", "--focus: var(--accent)"]),
    );
    expect(declarations.some((d) => d.startsWith("--same:"))).toBe(false);
    expect(declarations.some((d) => d.startsWith("--only-light:"))).toBe(false);
  });

  it("AC-T4 turns {alias} into var(--alias)", () => {
    expect(block(css, light)).toContain("--focus: var(--accent)");
  });

  it("AC-T5 puts non-color families on :root and shadows beside colors", () => {
    expect(block(css, ":root")).toEqual(
      expect.arrayContaining([
        "--space-1: 4px",
        "--radius-md: 6px",
        "--icon: 16px",
        "--aspect-wide: 16 / 9",
        "--z-hud: 10",
      ]),
    );
    expect(block(css, light)).toContain("--shadow-none: none");
  });

  it("AC-T6 exposes font families as --font-<key>", () => {
    expect(block(css, ":root")).toEqual(
      expect.arrayContaining([
        "--font-sans: system-ui, sans-serif",
        "--font-mono: ui-monospace, monospace",
      ]),
    );
  });

  it("AC-T7 writes one class per type style", () => {
    expect(block(css, ".display")).toEqual([
      "font-family: var(--font-sans)",
      "font-size: 32px",
      "line-height: 1.3",
      "font-weight: 700",
      "letter-spacing: -0.01em",
    ]);
    expect(block(css, ".code")).toEqual([
      "font-family: var(--font-mono)",
      "font-size: 13px",
      "line-height: 20px",
      "font-weight: 400",
    ]);
  });

  it("AC-T8 the committed tokens.css matches vendor/tokens.json", () => {
    const tokens = JSON.parse(
      readFileSync(new URL("../../src/design-system/vendor/tokens.json", import.meta.url), "utf8"),
    ) as Tokens;
    const committed = readFileSync(
      new URL("../../src/design-system/tokens.css", import.meta.url),
      "utf8",
    );
    expect(committed).toBe(tokensToCss(tokens));
  });
});
