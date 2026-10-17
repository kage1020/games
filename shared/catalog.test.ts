import { describe, expect, it } from "vitest";
import { CATALOG, GAME_IDS, isBetter, isValidScore, scoreOrder, scoreRule } from "./catalog.ts";

describe("catalog", () => {
  it("AC-S1 lists eight games, each with modes that carry an order and bounds", () => {
    expect(GAME_IDS).toHaveLength(8);
    for (const id of GAME_IDS) {
      const modes = Object.entries(CATALOG[id].modes);
      expect(modes.length).toBeGreaterThan(0);
      for (const [mode, rule] of modes) {
        expect(scoreRule(id, mode)).toBe(rule);
        expect(["asc", "desc"]).toContain(rule.order);
        expect(rule.min).toBeLessThan(rule.max);
      }
    }
  });

  it("AC-S1 returns no rule for unknown games and modes", () => {
    expect(scoreRule("mines", "hard")).toBeNull();
    expect(scoreRule("unknown", "normal")).toBeNull();
    expect(scoreRule("memory", "toString")).toBeNull();
  });

  it("AC-S1 gives the order of a known mode and throws for an unknown one", () => {
    expect(scoreOrder("mines", "easy")).toBe("asc");
    expect(scoreOrder("memory", "normal")).toBe("desc");
    expect(() => scoreOrder("mines", "hard")).toThrow();
  });

  it("AC-S2 rejects unknown games and modes, non-integers, and out-of-range scores", () => {
    const memory = scoreRule("memory", "normal");
    const reaction = scoreRule("reaction", "normal");
    if (!memory || !reaction) throw new Error("memory and reaction have a normal mode");
    expect(isValidScore("memory", "normal", 12)).toBe(true);
    expect(isValidScore("territory", "p4", 100)).toBe(true);
    expect(isValidScore("unknown", "normal", 1)).toBe(false);
    expect(isValidScore("memory", "hard", 1)).toBe(false);
    expect(isValidScore("memory", "normal", 1.5)).toBe(false);
    expect(isValidScore("memory", "normal", Number.NaN)).toBe(false);
    expect(isValidScore("memory", "normal", memory.max + 1)).toBe(false);
    expect(isValidScore("reaction", "normal", reaction.min - 1)).toBe(false);
  });

  it("AC-S3 compares scores by the mode's order", () => {
    expect(isBetter("desc", 10, 9)).toBe(true);
    expect(isBetter("desc", 9, 10)).toBe(false);
    expect(isBetter("asc", 200, 250)).toBe(true);
    expect(isBetter("asc", 250, 200)).toBe(false);
    expect(isBetter("asc", 200, 200)).toBe(false);
  });
});
