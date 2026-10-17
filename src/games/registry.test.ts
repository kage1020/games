import { CATALOG, GAME_IDS } from "@shared/catalog.ts";
import { describe, expect, it } from "vitest";
import { GAMES } from "./registry.ts";

describe("registry", () => {
  it("AC-S12 offers the catalog's games and modes", () => {
    expect(GAMES.map((game) => game.id).sort()).toEqual([...GAME_IDS].sort());
    for (const game of GAMES) {
      expect(game.modes.map((mode) => mode.id).sort()).toEqual(
        Object.keys(CATALOG[game.id].modes).sort(),
      );
    }
  });
});
