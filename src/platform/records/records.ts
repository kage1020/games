import type { PlayerBest } from "@shared/api.ts";
import { isBetter, type ScoreOrder } from "@shared/catalog.ts";

export interface PlayRecord {
  score: number;
  at: number;
}

export interface ModeRecord {
  best: number | null;
  plays: number;
  recent: PlayRecord[];
}

export type Records = Partial<Record<string, Partial<Record<string, ModeRecord>>>>;

export interface RecordOutcome {
  records: Records;
  isFirst: boolean;
  isBest: boolean;
  isTie: boolean;
  previousBest: number | null;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const RECORDS_KEY = "kg-games:records:v1";
const RECENT_LIMIT = 10;

const EMPTY: ModeRecord = { best: null, plays: 0, recent: [] };

export function getModeRecord(records: Records, game: string, mode: string): ModeRecord {
  return records[game]?.[mode] ?? EMPTY;
}

function withMode(records: Records, game: string, mode: string, record: ModeRecord): Records {
  return { ...records, [game]: { ...records[game], [mode]: record } };
}

export function recordPlay(
  records: Records,
  play: { game: string; mode: string; order: ScoreOrder; score: number | null; at: number },
): RecordOutcome {
  const current = getModeRecord(records, play.game, play.mode);
  const previousBest = current.best;
  if (play.score === null) {
    return {
      records: withMode(records, play.game, play.mode, { ...current, plays: current.plays + 1 }),
      isFirst: false,
      isBest: false,
      isTie: false,
      previousBest,
    };
  }
  const isFirst = previousBest === null;
  const isBest = isFirst || isBetter(play.order, play.score, previousBest);
  const next: ModeRecord = {
    best: isBest ? play.score : previousBest,
    plays: current.plays + 1,
    recent: [{ score: play.score, at: play.at }, ...current.recent].slice(0, RECENT_LIMIT),
  };
  return {
    records: withMode(records, play.game, play.mode, next),
    isFirst,
    isBest,
    isTie: !isFirst && play.score === previousBest,
    previousBest,
  };
}

export function mergeServerBests(
  records: Records,
  bests: PlayerBest[],
  orderOf: (game: string) => ScoreOrder | null,
): Records {
  return bests.reduce((merged, server) => {
    const order = orderOf(server.game);
    if (order === null) return merged;
    const local = getModeRecord(merged, server.game, server.mode);
    const best =
      local.best === null || isBetter(order, server.best, local.best) ? server.best : local.best;
    return withMode(merged, server.game, server.mode, {
      ...local,
      best,
      plays: Math.max(local.plays, server.plays),
    });
  }, records);
}

function isModeRecord(value: unknown): value is ModeRecord {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.best === null || typeof record.best === "number") &&
    typeof record.plays === "number" &&
    Array.isArray(record.recent) &&
    record.recent.every(
      (play: unknown) =>
        play !== null &&
        typeof play === "object" &&
        typeof (play as PlayRecord).score === "number" &&
        typeof (play as PlayRecord).at === "number",
    )
  );
}

export function parseRecords(raw: string | null): Records {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return {};
    for (const modes of Object.values(parsed)) {
      if (modes === null || typeof modes !== "object") return {};
      if (!Object.values(modes).every(isModeRecord)) return {};
    }
    return parsed as Records;
  } catch {
    return {};
  }
}

export function loadRecords(storage: KeyValueStorage): Records {
  try {
    return parseRecords(storage.getItem(RECORDS_KEY));
  } catch {
    return {};
  }
}

export function saveRecords(storage: KeyValueStorage, records: Records): void {
  try {
    storage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // 保存できない環境（プライベートブラウズなど）では、ページを開いている間だけメモリに持つ
  }
}
