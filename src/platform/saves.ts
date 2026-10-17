import type { HudItem, SaveData } from "@/sdk/types.ts";
import { createPersistentStore } from "./store.ts";

/** 続きの様子。大きな状態は stateKey に別に置き、一覧を読むたびには読まない */
export const SAVES_KEY = "kg-games:saves:v1";

export interface SaveEntry {
  summary: HudItem[];
  /** 保存した時刻（ミリ秒） */
  at: number;
}

export type Saves = Record<string, SaveEntry>;

const slot = (game: string, mode: string) => `${game}:${mode}`;
const stateKey = (game: string, mode: string) => `kg-games:save:v1:${slot(game, mode)}`;

function isHudItem(value: unknown): value is HudItem {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.label === "string" &&
    typeof item.value === "string" &&
    (item.unit === undefined || typeof item.unit === "string")
  );
}

function isSaveEntry(value: unknown): value is SaveEntry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.at === "number" && Array.isArray(entry.summary) && entry.summary.every(isHudItem)
  );
}

export function parseSaves(raw: string | null): Saves {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => isSaveEntry(entry)));
  } catch {
    return {};
  }
}

export const savesStore = createPersistentStore(SAVES_KEY, parseSaves);

export function getSave(saves: Saves, game: string, mode: string): SaveEntry | null {
  return saves[slot(game, mode)] ?? null;
}

/** 保存した状態。ない・読めないときは null */
export function readSave(game: string, mode: string): unknown {
  try {
    const raw = window.localStorage.getItem(stateKey(game, mode));
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** 途中を保存する。null なら消す。状態を書けなかったときは様子も前のまま残す */
export function writeSave(
  game: string,
  mode: string,
  save: SaveData | null,
  at = Date.now(),
): void {
  const key = slot(game, mode);
  try {
    if (save === null) window.localStorage.removeItem(stateKey(game, mode));
    else window.localStorage.setItem(stateKey(game, mode), JSON.stringify(save.state));
  } catch {
    return;
  }
  savesStore.set((saves) => {
    const { [key]: _, ...others } = saves;
    return save === null ? others : { ...others, [key]: { summary: save.summary, at } };
  });
}
