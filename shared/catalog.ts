export const GAME_IDS = [
  "memory",
  "zip",
  "territory",
  "snake",
  "stack",
  "reaction",
  "mines",
  "breakout",
] as const;

export type GameId = (typeof GAME_IDS)[number];
export type ScoreOrder = "asc" | "desc";

export interface ScoreRule {
  order: ScoreOrder;
  /** 人の手で出せる範囲。これを外れた記録はランキングに入れない */
  min: number;
  max: number;
}

export interface CatalogEntry {
  modes: Readonly<Record<string, ScoreRule>>;
}

const MINUTE = 60_000;

export const CATALOG: Record<GameId, CatalogEntry> = {
  memory: { modes: { normal: { order: "desc", min: 0, max: 40 } } },
  zip: { modes: { normal: { order: "asc", min: 5_000, max: 60 * MINUTE } } },
  territory: {
    modes: {
      p2: { order: "desc", min: 0, max: 256 },
      p3: { order: "desc", min: 0, max: 256 },
      p4: { order: "desc", min: 0, max: 256 },
    },
  },
  snake: { modes: { normal: { order: "desc", min: 0, max: 397 } } },
  stack: { modes: { normal: { order: "desc", min: 0, max: 10_000 } } },
  reaction: { modes: { normal: { order: "asc", min: 80, max: 10_000 } } },
  mines: {
    modes: {
      easy: { order: "asc", min: 1_000, max: 60 * MINUTE },
      normal: { order: "asc", min: 1_000, max: 60 * MINUTE },
      infinite: { order: "desc", min: 1, max: 1_000_000 },
    },
  },
  breakout: { modes: { normal: { order: "desc", min: 0, max: 100_000 } } },
};

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}

export function scoreRule(game: string, mode: string): ScoreRule | null {
  if (!isGameId(game)) return null;
  const { modes } = CATALOG[game];
  return Object.hasOwn(modes, mode) ? (modes[mode] ?? null) : null;
}

/** モードを確かめてから使う。カタログにないモードはプログラムの誤りなので投げる */
export function scoreOrder(game: string, mode: string): ScoreOrder {
  const rule = scoreRule(game, mode);
  if (rule === null) throw new Error(`カタログにないモード: ${game}/${mode}`);
  return rule.order;
}

export function isValidMode(game: string, mode: string): boolean {
  return scoreRule(game, mode) !== null;
}

export function isValidScore(game: string, mode: string, score: number): boolean {
  const rule = scoreRule(game, mode);
  if (rule === null || !Number.isInteger(score)) return false;
  return score >= rule.min && score <= rule.max;
}

export function isBetter(order: ScoreOrder, a: number, b: number): boolean {
  return order === "desc" ? a > b : a < b;
}
