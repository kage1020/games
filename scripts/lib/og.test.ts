import { describe, expect, it } from "vitest";
import { ogSvg, resolveSvgVars } from "./og.ts";

const SITE = { label: "games", domain: ".kage1020.com", tagline: "小さな遊び。" };

describe("ogSvg", () => {
  it("AC-I1 draws the site name and the tagline only", () => {
    const svg = ogSvg(SITE);
    expect(svg).toContain(">games<tspan");
    expect(svg).toContain('fill="var(--ink-muted)">.kage1020.com</tspan>');
    expect(svg).toContain(">小さな遊び。</text>");
    expect(svg.match(/<svg\b/g)).toHaveLength(1);
    expect(svg.match(/<text\b/g)).toHaveLength(2);
  });
});

describe("resolveSvgVars", () => {
  it("AC-I2 replaces variables and expands the font shorthand", () => {
    const resolved = resolveSvgVars(ogSvg(SITE), {
      colors: { bg: "#ffffff", ink: "#252525", "ink-muted": "#737373" },
      fonts: { sans: "'Noto Sans JP', sans-serif", mono: "Consolas, monospace" },
    });
    expect(resolved).not.toContain("var(");
    expect(resolved).not.toMatch(/font:/);
    expect(resolved).toContain('fill="#737373">.kage1020.com');
    expect(resolved).toContain("font-family:Consolas, monospace");
    expect(resolved).toMatch(
      /font-weight:600;font-size:\d+px;font-family:'Noto Sans JP', sans-serif/,
    );
  });
});
