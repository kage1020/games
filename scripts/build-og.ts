import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { createServer } from "vite";
import { alias } from "../vite.config.ts";
import { resolveThemeColors } from "./lib/color.ts";
import type { Tokens } from "./lib/tokens-to-css.ts";

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 64;
const GAP = 24;
const COLUMNS = 4;

// 絵にする道具はシステムのフォントを名前で探すので、トークンの並びのうち手元にあるものを先に書く
const FONTS = {
  sans: "'Yu Gothic UI', 'Hiragino Sans', 'Noto Sans JP', Meiryo, sans-serif",
  mono: "Consolas, Menlo, 'DejaVu Sans Mono', monospace",
};

type Thumb = { id: string; title: string; svg: string };

const tokens = JSON.parse(
  readFileSync(new URL("../src/design-system/vendor/tokens.json", import.meta.url), "utf8"),
) as Tokens;
const colors = resolveThemeColors(tokens, "light");

/** CSS 変数を値にし、絵にする道具が読まない font の一括指定を個別の指定に開く */
function resolveVars(svg: string): string {
  return svg
    .replace(/var\(--font-(sans|mono)\)/g, (_, key: "sans" | "mono") => FONTS[key])
    .replace(/var\(--([a-z0-9-]+)\)/g, (match, name: string) => colors[name] ?? match)
    .replace(
      /font:\s*(\d+)\s+([\d.]+)px\s+([^;"]+)/g,
      (_, weight: string, size: string, family: string) =>
        `font-weight:${weight};font-size:${size}px;font-family:${family.trim()}`,
    );
}

function place(thumb: Thumb, index: number, size: { width: number; height: number }): string {
  const x = MARGIN + (index % COLUMNS) * (size.width + GAP);
  const y = HEIGHT - MARGIN - (2 - Math.floor(index / COLUMNS)) * (size.height + GAP) + GAP;
  const inner = thumb.svg.replace(
    /^<svg /,
    `<svg x="${x}" y="${y}" width="${size.width}" height="${size.height}" `,
  );
  return `${inner}<rect x="${x + 0.5}" y="${y + 0.5}" width="${size.width - 1}" height="${size.height - 1}" rx="8" fill="none" stroke="var(--line)"/>`;
}

const server = await createServer({
  configFile: false,
  logLevel: "error",
  resolve: { alias },
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});

try {
  const module = (await server.ssrLoadModule("/src/og/thumbs.tsx")) as {
    renderThumbs: () => Thumb[];
  };
  const thumbs = module.renderThumbs();
  const width = (WIDTH - MARGIN * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const size = { width, height: Math.round((width * 9) / 16) };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="var(--bg)"/>
  <text x="${MARGIN}" y="${MARGIN + 28}" style="font: 600 32px var(--font-sans)" fill="var(--ink)">game<tspan style="font: 400 28px var(--font-mono)" fill="var(--ink-muted)">.kage1020.com</tspan></text>
  <text x="${MARGIN}" y="${MARGIN + 104}" style="font: 500 56px var(--font-sans)" fill="var(--ink)">${thumbs.length} つのゲーム</text>
  <text x="${MARGIN}" y="${MARGIN + 150}" style="font: 400 26px var(--font-sans)" fill="var(--ink-muted)">小さな遊び。どれも登録なしで遊べる。</text>
  ${thumbs.map((thumb, i) => place(thumb, i, size)).join("\n  ")}
</svg>`;
  const png = new Resvg(resolveVars(svg), {
    fitTo: { mode: "width", value: WIDTH },
    font: { loadSystemFonts: true, defaultFontFamily: "Yu Gothic UI" },
  })
    .render()
    .asPng();
  const target = new URL("../public/og.png", import.meta.url);
  writeFileSync(target, png);
  console.log(`wrote ${target.pathname} (${png.length} bytes)`);
} finally {
  await server.close();
}
