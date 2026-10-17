import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { SITE_DOMAIN, SITE_LABEL, SITE_TAGLINE } from "../src/app/site.ts";
import { resolveThemeColors } from "./lib/color.ts";
import { OG_WIDTH, ogSvg, resolveSvgVars } from "./lib/og.ts";
import type { Tokens } from "./lib/tokens-to-css.ts";

// resvg はシステムフォントを名前で探すので、トークンのフォントスタックのうちこの環境にあるものを先に書く
const FONTS = {
  sans: "'Yu Gothic UI', 'Hiragino Sans', 'Noto Sans JP', Meiryo, sans-serif",
  mono: "Consolas, Menlo, 'DejaVu Sans Mono', monospace",
};

const tokens = JSON.parse(
  readFileSync(new URL("../src/design-system/vendor/tokens.json", import.meta.url), "utf8"),
) as Tokens;

const svg = resolveSvgVars(
  ogSvg({ label: SITE_LABEL, domain: SITE_DOMAIN, tagline: SITE_TAGLINE }),
  { colors: resolveThemeColors(tokens, "light"), fonts: FONTS },
);
const png = new Resvg(svg, {
  fitTo: { mode: "width", value: OG_WIDTH },
  font: { loadSystemFonts: true, defaultFontFamily: "Yu Gothic UI" },
})
  .render()
  .asPng();
const target = new URL("../public/og.png", import.meta.url);
writeFileSync(target, png);
console.log(`wrote ${target.pathname} (${png.length} bytes)`);
