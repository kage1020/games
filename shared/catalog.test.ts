import { describe, expect, it } from "vitest";
import { CATALOG, GAME_IDS, isBetter, isValidScore } from "./catalog.ts";

describe("catalog", () => {
  it("AC-S1 lists eight games, each with modes, an order, and bounds", () => {
    expect(GAME_IDS).toHaveLength(8);
    for (const id of GAME_IDS) {
      const entry = CATALOG[id];
      expect(entry.modes.length).toBeGreaterThan(0);
      expect(["asc", "desc"]).toContain(entry.order);
      expect(entry.min).toBeLessThan(entry.max);
    }
  });

  it("AC-S2 rejects unknown games and modes, non-integers, and out-of-range scores", () => {
    expect(isValidScore("memory", "normal", 12)).toBe(true);
    expect(isValidScore("territory", "p4", 100)).toBe(true);
    expect(isValidScore("unknown", "normal", 1)).toBe(false);
    expect(isValidScore("memory", "hard", 1)).toBe(false);
    expect(isValidScore("memory", "normal", 1.5)).toBe(false);
    expect(isValidScore("memory", "normal", Number.NaN)).toBe(false);
    expect(isValidScore("memory", "normal", CATALOG.memory.max + 1)).toBe(false);
    expect(isValidScore("reaction", "normal", CATALOG.reaction.min - 1)).toBe(false);
  });

  it("AC-S3 compares scores by the game's order", () => {
    expect(isBetter("desc", 10, 9)).toBe(true);
    expect(isBetter("desc", 9, 10)).toBe(false);
    expect(isBetter("asc", 200, 250)).toBe(true);
    expect(isBetter("asc", 250, 200)).toBe(false);
    expect(isBetter("asc", 200, 200)).toBe(false);
  });
});
