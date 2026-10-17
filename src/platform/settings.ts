import { type GameId, isGameId } from "@shared/catalog.ts";
import { createPersistentStore } from "./store.ts";

export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export interface Settings {
  theme: ThemePreference;
  /** 0〜100。0 は鳴らさない */
  volume: number;
  muted: boolean;
  favorites: GameId[];
  modes: Partial<Record<GameId, string>>;
  /** ランキングでの名前。null はサーバーが決める既定の名前 */
  name: string | null;
}

/** public/theme-init.js も同じキーを読む */
export const SETTINGS_KEY = "kg-games:settings:v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  volume: 60,
  muted: false,
  favorites: [],
  modes: {},
  name: null,
};

export function parseSettings(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object") return DEFAULT_SETTINGS;
    const data = value as Record<string, unknown>;
    const modes =
      data.modes !== null && typeof data.modes === "object"
        ? Object.fromEntries(
            Object.entries(data.modes as Record<string, unknown>).filter(
              (entry): entry is [GameId, string] =>
                isGameId(entry[0]) && typeof entry[1] === "string",
            ),
          )
        : {};
    return {
      theme: data.theme === "light" || data.theme === "dark" ? data.theme : "system",
      volume:
        typeof data.volume === "number" && data.volume >= 0 && data.volume <= 100
          ? data.volume
          : DEFAULT_SETTINGS.volume,
      muted: data.muted === true,
      favorites: Array.isArray(data.favorites)
        ? data.favorites.filter((id): id is GameId => typeof id === "string" && isGameId(id))
        : [],
      modes,
      name: typeof data.name === "string" && data.name !== "" ? data.name : null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): Theme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

export const settingsStore = createPersistentStore(SETTINGS_KEY, parseSettings);

export function toggleFavorite(id: GameId): void {
  settingsStore.set((current) => ({
    ...current,
    favorites: current.favorites.includes(id)
      ? current.favorites.filter((favorite) => favorite !== id)
      : [...current.favorites, id],
  }));
}
