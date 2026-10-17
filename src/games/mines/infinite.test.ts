import { describe, expect, it } from "vitest";
import {
  adjacentMines,
  cellKey,
  createInfinite,
  DENSITY,
  type InfiniteState,
  isMine,
  neighbors,
  reveal,
  tick,
  toggleFlag,
} from "./infinite.ts";

const started = (seed: number, x = 0, y = 0): InfiniteState => reveal(createInfinite(seed), x, y);

function isOpen(state: InfiniteState, x: number, y: number): boolean {
  return state.revealed.has(cellKey(x, y));
}

/** 開いた数字のマスのうち、閉じた周りがあるものを 1 つ探す */
function numberWithClosedNeighbours(state: InfiniteState): { x: number; y: number } {
  for (const key of state.revealed.keys()) {
    const [x = 0, y = 0] = key.split(",").map(Number);
    if ((state.revealed.get(key) ?? 0) === 0) continue;
    if (neighbors(x, y).some((cell) => !isOpen(state, cell.x, cell.y))) return { x, y };
  }
  throw new Error("閉じた周りを持つ数字のマスがない");
}

describe("infinite mines", () => {
  it("AC-G-mines-7 places mines from the seed and position only", () => {
    const a = started(7);
    const b = started(7);
    const c = started(8);
    let same = 0;
    let differs = 0;
    for (let x = -40; x < 40; x++) {
      for (let y = -40; y < 40; y++) {
        expect(isMine(a, x, y)).toBe(isMine(b, x, y));
        if (isMine(a, x, y) === isMine(c, x, y)) same++;
        else differs++;
      }
    }
    expect(differs).toBeGreaterThan(0);
    expect(same).toBeGreaterThan(differs);
  });

  it("AC-G-mines-7 makes about 18% of cells mines", () => {
    const state = started(3, 5000, 5000);
    let mines = 0;
    const side = 200;
    for (let x = 0; x < side; x++) for (let y = 0; y < side; y++) if (isMine(state, x, y)) mines++;
    expect(DENSITY).toBe(0.18);
    expect(mines / (side * side)).toBeGreaterThan(0.17);
    expect(mines / (side * side)).toBeLessThan(0.19);
  });

  it("AC-G-mines-7 keeps the first cell and its neighbours free of mines", () => {
    expect(isMine(createInfinite(1), 0, 0)).toBe(false);
    for (let seed = 1; seed <= 200; seed++) {
      const state = started(seed, seed * 3, -seed);
      expect(state.phase).toBe("playing");
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          expect(isMine(state, seed * 3 + dx, -seed + dy)).toBe(false);
        }
      }
      expect(state.revealed.size).toBeGreaterThanOrEqual(9);
    }
  });

  it("AC-G-mines-8 opens connected zero cells and their edge, and the opening stops", () => {
    let largest = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const state = started(seed);
      largest = Math.max(largest, state.revealed.size);
      for (const [key, count] of state.revealed) {
        const [x = 0, y = 0] = key.split(",").map(Number);
        expect(count).toBe(adjacentMines(state, x, y));
        expect(isMine(state, x, y)).toBe(false);
        if (count === 0) {
          for (const cell of neighbors(x, y)) expect(isOpen(state, cell.x, cell.y)).toBe(true);
        }
      }
    }
    expect(largest).toBeLessThan(5000);
  });

  it("AC-G-mines-9 opens the closed neighbours of a number when its flags match", () => {
    const state = started(11);
    const target = numberWithClosedNeighbours(state);
    let flagged = state;
    for (const cell of neighbors(target.x, target.y)) {
      if (isMine(state, cell.x, cell.y)) flagged = toggleFlag(flagged, cell.x, cell.y);
    }
    const chorded = reveal(flagged, target.x, target.y);
    expect(chorded.phase).toBe("playing");
    for (const cell of neighbors(target.x, target.y)) {
      const mine = isMine(state, cell.x, cell.y);
      expect(isOpen(chorded, cell.x, cell.y)).toBe(!mine);
    }
  });

  it("AC-G-mines-9 does nothing when the flags do not match, and never opens a flag", () => {
    const state = started(11);
    const target = numberWithClosedNeighbours(state);
    expect(reveal(state, target.x, target.y)).toBe(state);

    const closed = neighbors(target.x, target.y).find((cell) => !isOpen(state, cell.x, cell.y));
    if (!closed) throw new Error("閉じた周りがない");
    const flagged = toggleFlag(state, closed.x, closed.y);
    expect(flagged.flagged.has(cellKey(closed.x, closed.y))).toBe(true);
    expect(reveal(flagged, closed.x, closed.y)).toBe(flagged);
    expect(toggleFlag(flagged, closed.x, closed.y).flagged.size).toBe(0);
    expect(toggleFlag(state, target.x, target.y)).toBe(state);
  });

  it("AC-G-mines-10 ends on a mine and keeps the opened count as the score", () => {
    const state = started(5);
    let mine: { x: number; y: number } | null = null;
    for (let r = 2; mine === null; r++) {
      for (let x = -r; x <= r && mine === null; x++) {
        for (let y = -r; y <= r && mine === null; y++) {
          if (isMine(state, x, y) && !isOpen(state, x, y)) mine = { x, y };
        }
      }
    }
    const lost = reveal(state, mine.x, mine.y);
    expect(lost.phase).toBe("lost");
    expect(lost.exploded).toEqual(mine);
    expect(lost.revealed.size).toBe(state.revealed.size);
    expect(reveal(lost, 100, 100)).toBe(lost);
    expect(toggleFlag(lost, 100, 100)).toBe(lost);
  });

  it("AC-G-mines-10 counts time only while playing", () => {
    const ready = createInfinite(2);
    expect(tick(ready, 500)).toBe(ready);
    const playing = started(2);
    const state = tick(tick(playing, 400), 600);
    expect(state.elapsed).toBe(1000);
    expect(state.revealed).toBe(playing.revealed);
  });
});
