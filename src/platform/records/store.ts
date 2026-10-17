import type { PlayerBest } from "@shared/api.ts";
import { CATALOG, isGameId } from "@shared/catalog.ts";
import { createPersistentStore } from "../store.ts";
import { mergeServerBests, parseRecords, RECORDS_KEY } from "./records.ts";

export const recordsStore = createPersistentStore(RECORDS_KEY, parseRecords);

export function importServerBests(bests: PlayerBest[]): void {
  recordsStore.set((records) =>
    mergeServerBests(records, bests, (game) => (isGameId(game) ? CATALOG[game].order : null)),
  );
}
