import type { Tokens } from "./tokens-to-css.ts";

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;
const ALIAS = /^\{(.+)\}$/;

function gamma(linear: number): number {
  const v = Math.min(1, Math.max(0, linear));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

function channel(value: number): string {
  return Math.round(gamma(value) * 255)
    .toString(16)
    .padStart(2, "0");
}

/** トークンの色（hex か oklch）を、SVG を絵にする道具でも読める hex にする */
export function toHex(value: string): string {
  if (value.startsWith("#")) return value.toLowerCase();
  const match = OKLCH.exec(value);
  if (!match) throw new Error(`読めない色: ${value}`);
  const [l, c, h] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  return `#${channel(r)}${channel(g)}${channel(bl)}`;
}

export function resolveThemeColors(tokens: Tokens, theme: string): Record<string, string> {
  const first = tokens.color.themes[0]?.id;
  const raw = new Map(
    tokens.color.tokens.map((token) => [
      token.name,
      typeof token.value === "string"
        ? token.value
        : (token.value[theme] ?? (first ? token.value[first] : undefined) ?? ""),
    ]),
  );
  const resolve = (name: string, depth = 0): string => {
    const value = raw.get(name);
    if (value === undefined || depth > 16) throw new Error(`色がない: ${name}`);
    const alias = ALIAS.exec(value);
    return alias?.[1] ? resolve(alias[1], depth + 1) : toHex(value);
  };
  return Object.fromEntries([...raw.keys()].map((name) => [name, resolve(name)]));
}
