import { describe, expect, it } from "vitest";
import { createRng } from "@/sdk/rng.ts";
import {
  advance,
  COLS,
  createMemory,
  MAX_LEVEL,
  type MemoryState,
  press,
  ROWS,
  START_LEVEL,
} from "./logic.ts";

const cellOf = (state: MemoryState, value: number) => state.cells.indexOf(value);
const emptyCell = (state: MemoryState) => state.cells.indexOf(null);

function clearLevel(state: MemoryState): MemoryState {
  let current = state;
  for (let n = 1; n <= state.level; n++) current = press(current, cellOf(current, n));
  return current;
}

describe("memory", () => {
  it("AC-G-memory-1 places 1..n on distinct cells of an 8×5 board, starting at 4", () => {
    const state = createMemory(createRng(1));
    expect(COLS * ROWS).toBe(40);
    expect(state.cells).toHaveLength(40);
    expect(state.level).toBe(START_LEVEL);
    const numbers = state.cells.filter((cell) => cell !== null).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual([1, 2, 3, 4]);
  });

  it("AC-G-memory-1 is decided by the seed", () => {
    expect(createMemory(createRng(5)).cells).toEqual(createMemory(createRng(5)).cells);
  });

  it("AC-G-memory-2 shows every number until 1 is pressed", () => {
    const state = createMemory(createRng(2));
    expect(state.phase).toBe("show");
    const after = press(state, cellOf(state, 1));
    expect(after.phase).toBe("hidden");
    expect(after.next).toBe(2);
  });

  it("AC-G-memory-3 ignores empty cells and already pressed numbers", () => {
    const state = createMemory(createRng(3));
    expect(press(state, emptyCell(state))).toBe(state);
    const after = press(state, cellOf(state, 1));
    expect(press(after, cellOf(after, 1))).toBe(after);
  });

  it("AC-G-memory-4 clears the level after pressing up to n and moves to n+1", () => {
    const rng = createRng(4);
    const cleared = clearLevel(createMemory(rng));
    expect(cleared.phase).toBe("cleared");
    expect(cleared.best).toBe(START_LEVEL);
    const next = advance(cleared, rng);
    expect(next).toMatchObject({
      phase: "show",
      level: START_LEVEL + 1,
      next: 1,
      best: START_LEVEL,
    });
    expect(next.cells.filter((cell) => cell !== null)).toHaveLength(START_LEVEL + 1);
  });

  it("AC-G-memory-5 counts a wrong order as a miss and retries the same level", () => {
    const rng = createRng(6);
    let state = createMemory(rng);
    state = press(state, cellOf(state, 1));
    const missed = press(state, cellOf(state, 3));
    expect(missed).toMatchObject({ phase: "missed", misses: 1, wrongCell: cellOf(state, 3) });
    const retry = advance(missed, rng);
    expect(retry).toMatchObject({ phase: "show", level: START_LEVEL, misses: 1, next: 1 });
  });

  it("AC-G-memory-5 ends after three misses", () => {
    const rng = createRng(7);
    let state = createMemory(rng);
    for (let i = 0; i < 3; i++) {
      state = press(state, cellOf(state, 2));
      if (i < 2) state = advance(state, rng);
    }
    expect(state).toMatchObject({ phase: "over", misses: 3, best: 0 });
    expect(advance(state, rng)).toBe(state);
    expect(press(state, cellOf(state, 1))).toBe(state);
  });

  it("AC-G-memory-6 ends after clearing 40 with 40 as the record", () => {
    const rng = createRng(8);
    let state = createMemory(rng);
    while (state.phase !== "over") {
      state = clearLevel(state);
      if (state.phase === "cleared") state = advance(state, rng);
    }
    expect(state.level).toBe(MAX_LEVEL);
    expect(state.best).toBe(MAX_LEVEL);
  });
});
