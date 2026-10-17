type ThemedValue = string | Record<string, string>;

interface Token {
  name: string;
  value: ThemedValue;
  usage?: string;
}

interface TokenFamily {
  note?: string;
  tokens: Token[];
}

interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number | string;
  letterSpacing?: string;
  family?: string;
}

export interface Tokens {
  name: string;
  version: number;
  color: TokenFamily & { themes: { id: string; name: string }[] };
  type: {
    fonts: unknown[];
    families: Record<string, string>;
    groups: { name: string; family: string; note?: string; styles: TypeStyle[] }[];
  };
  [family: string]: unknown;
}

const NON_ROOT_FAMILIES = new Set(["name", "version", "meta", "color", "type", "shadow"]);
const ALIAS = /^\{([A-Za-z0-9][A-Za-z0-9_.-]*)\}$/;

function resolve(value: ThemedValue, theme: string, firstTheme: string): string | undefined {
  if (typeof value === "string") return theme === firstTheme ? value : undefined;
  return value[theme];
}

function cssValue(raw: string): string {
  const alias = ALIAS.exec(raw);
  return alias ? `var(--${alias[1]})` : raw;
}

function isAlias(token: Token): boolean {
  return typeof token.value === "string" && ALIAS.test(token.value);
}

function rule(selector: string, declarations: string[]): string {
  return `${selector} {\n${declarations.map((d) => `  ${d};`).join("\n")}\n}`;
}

function familyTokens(tokens: Tokens, key: string): Token[] {
  const family = tokens[key] as TokenFamily | undefined;
  return family?.tokens ?? [];
}

const LENGTH_FAMILIES = new Set(["spacing", "radius"]);

function plainValue(family: string, value: ThemedValue): string {
  if (typeof value !== "string") throw new Error(`${family} tokens take a single value`);
  const bareNumber = /^-?\d+(\.\d+)?$/.test(value) && value !== "0";
  return LENGTH_FAMILIES.has(family) && bareNumber ? `${value}px` : value;
}

export function tokensToCss(tokens: Tokens): string {
  const [first, ...rest] = tokens.color.themes;
  if (!first) throw new Error("tokens.json needs at least one theme");
  const colors = tokens.color.tokens;
  const shadows = familyTokens(tokens, "shadow");

  const firstThemeDeclarations = [...colors, ...shadows].flatMap((token) => {
    const value = resolve(token.value, first.id, first.id);
    return value === undefined ? [] : [`--${token.name}: ${cssValue(value)}`];
  });

  const themeRules = rest.map((theme) => {
    const declarations = [...colors, ...shadows].flatMap((token) => {
      if (isAlias(token)) return [`--${token.name}: ${cssValue(token.value as string)}`];
      const value = resolve(token.value, theme.id, first.id);
      const base = resolve(token.value, first.id, first.id);
      return value === undefined || value === base ? [] : [`--${token.name}: ${cssValue(value)}`];
    });
    return rule(`[data-theme="${theme.id}"]`, declarations);
  });

  const rootFamilies = Object.keys(tokens).filter((key) => !NON_ROOT_FAMILIES.has(key));
  const ordered = [
    ...["spacing", "radius"].filter((key) => key in tokens),
    ...rootFamilies.filter((key) => key !== "spacing" && key !== "radius"),
  ];
  const rootDeclarations = [
    ...ordered.flatMap((key) =>
      familyTokens(tokens, key).map((token) => `--${token.name}: ${plainValue(key, token.value)}`),
    ),
    ...Object.entries(tokens.type.families).map(([key, stack]) => `--font-${key}: ${stack}`),
  ];

  const styleRules = tokens.type.groups.flatMap((group) =>
    group.styles.map((style) =>
      rule(`.${style.name}`, [
        `font-family: var(--font-${style.family ?? group.family})`,
        `font-size: ${style.fontSize}`,
        `line-height: ${style.lineHeight}`,
        `font-weight: ${style.fontWeight}`,
        ...(style.letterSpacing ? [`letter-spacing: ${style.letterSpacing}`] : []),
      ]),
    ),
  );

  return [
    `/* ${tokens.name} — generated from tokens.json */`,
    rule(`:root, [data-theme="${first.id}"]`, firstThemeDeclarations),
    ...themeRules,
    rule(":root", rootDeclarations),
    ...styleRules,
    "",
  ].join("\n");
}
