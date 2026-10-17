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

export interface CatalogEntry {
  modes: readonly string[];
  order: ScoreOrder;
  /** 人の手で出せる範囲。これを外れた記録はランキングに入れない */
  min: number;
  max: number;
}

const MINUTE = 60_000;

export const CATALOG: Record<GameId, CatalogEntry> = {
  memory: { modes: ["normal"], order: "desc", min: 0, max: 40 },
  zip: { modes: ["normal"], order: "asc", min: 5_000, max: 60 * MINUTE },
  territory: { modes: ["p2", "p3", "p4"], order: "desc", min: 0, max: 256 },
  snake: { modes: ["normal"], order: "desc", min: 0, max: 397 },
  stack: { modes: ["normal"], order: "desc", min: 0, max: 10_000 },
  reaction: { modes: ["normal"], order: "asc", min: 80, max: 10_000 },
  mines: { modes: ["easy", "normal"], order: "asc", min: 1_000, max: 60 * MINUTE },
  breakout: { modes: ["normal"], order: "desc", min: 0, max: 100_000 },
};

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}

export function isValidMode(game: string, mode: string): boolean {
  return isGameId(game) && CATALOG[game].modes.includes(mode);
}

export function isValidScore(game: string, mode: string, score: number): boolean {
  if (!isGameId(game) || !isValidMode(game, mode) || !Number.isInteger(score)) return false;
  const { min, max } = CATALOG[game];
  return score >= min && score <= max;
}

export function isBetter(order: ScoreOrder, a: number, b: number): boolean {
  return order === "desc" ? a > b : a < b;
}
