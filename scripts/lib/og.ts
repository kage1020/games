export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const MARGIN = 96;
const NAME_BASELINE = 300;
const TAGLINE_BASELINE = 384;

export interface OgSite {
  label: string;
  domain: string;
  tagline: string;
}

export interface SvgVars {
  colors: Record<string, string>;
  fonts: Record<"sans" | "mono", string>;
}

/** 帯と同じ組み方のサイト名と一文。色とフォントは CSS 変数のまま書く */
export function ogSvg({ label, domain, tagline }: OgSite): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="var(--bg)"/>
  <text x="${MARGIN}" y="${NAME_BASELINE}" style="font: 600 96px var(--font-sans)" fill="var(--ink)">${label}<tspan style="font: 400 80px var(--font-mono)" fill="var(--ink-muted)">${domain}</tspan></text>
  <text x="${MARGIN}" y="${TAGLINE_BASELINE}" style="font: 400 36px var(--font-sans)" fill="var(--ink-muted)">${tagline}</text>
</svg>`;
}

/** resvg は CSS 変数と font ショートハンドを読まないので、値と個別のプロパティに展開する */
export function resolveSvgVars(svg: string, { colors, fonts }: SvgVars): string {
  return svg
    .replace(/var\(--font-(sans|mono)\)/g, (_, key: "sans" | "mono") => fonts[key])
    .replace(/var\(--([a-z0-9-]+)\)/g, (match, name: string) => colors[name] ?? match)
    .replace(
      /font:\s*(\d+)\s+([\d.]+)px\s+([^;"]+)/g,
      (_, weight: string, size: string, family: string) =>
        `font-weight:${weight};font-size:${size}px;font-family:${family.trim()}`,
    );
}
