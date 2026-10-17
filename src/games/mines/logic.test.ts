import { describe, expect, it } from "vitest";
import { createRng } from "@/sdk/rng.ts";
import {
  adjacentMines,
  createMines,
  flagsLeft,
  type MinesState,
  MODES,
  placeMines,
  reveal,
  tick,
  toggleFlag,
} from "./logic.ts";

/** 9×9 の盤で、決めた位置に地雷を置いて始める */
function board(mines: number[], mode: "easy" | "normal" = "easy"): MinesState {
  return placeMines(createMines(mode), mines);
}

const mineCount = (state: MinesState) => state.mines?.filter(Boolean).length ?? 0;

describe("mines", () => {
  it("AC-G-mines-1 offers 初級 9×9 with 10 mines and 中級 16×16 with 40", () => {
    expect(MODES.easy).toEqual({ cols: 9, rows: 9, mines: 10 });
    expect(MODES.normal).toEqual({ cols: 16, rows: 16, mines: 40 });
    const easy = createMines("easy");
    expect(easy.revealed).toHaveLength(81);
    expect(easy.phase).toBe("ready");
    expect(createMines("normal").revealed).toHaveLength(256);
  });

  it("AC-G-mines-2 keeps the first cell and its neighbours free of mines", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const [mode, first] of [
        ["easy", 40],
        ["easy", 0],
        ["normal", 135],
      ] as const) {
        const state = reveal(createMines(mode), first, createRng(seed));
        const { cols } = MODES[mode];
        expect(mineCount(state)).toBe(MODES[mode].mines);
        const x = first % cols;
        const y = Math.floor(first / cols);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (x + dx < 0 || y + dy < 0 || x + dx >= cols || y + dy >= cols) continue;
            expect(state.mines?.[(y + dy) * cols + x + dx]).toBe(false);
          }
        }
        expect(state.revealed[first]).toBe(true);
        expect(state.phase).not.toBe("lost");
      }
    }
  });

  it("AC-G-mines-3 opens connected zeros and their edge at once", () => {
    // 地雷は右下の 1 つだけ（80）。左上を開くと、80 以外がすべて開く
    const state = reveal(board([80]), 0, createRng(1));
    expect(state.revealed.filter(Boolean)).toHaveLength(80);
    expect(state.revealed[80]).toBe(false);
    expect(adjacentMines(state, 70)).toBe(1);
  });

  it("AC-G-mines-3 opens only the cell itself when it has a number", () => {
    const state = reveal(board([1]), 0, createRng(1));
    expect(state.revealed.filter(Boolean)).toHaveLength(1);
    expect(adjacentMines(state, 0)).toBe(1);
  });

  it("AC-G-mines-4 toggles flags only on closed cells, and flagged cells do not open", () => {
    let state = board([1, 2]);
    state = toggleFlag(state, 1);
    expect(state.flagged[1]).toBe(true);
    expect(flagsLeft(state)).toBe(MODES.easy.mines - 1);
    expect(reveal(state, 1, createRng(1))).toBe(state);
    expect(toggleFlag(state, 1).flagged[1]).toBe(false);
    const opened = reveal(state, 9, createRng(1));
    expect(toggleFlag(opened, 9)).toBe(opened);
  });

  it("AC-G-mines-4 keeps flagged cells closed during a flood", () => {
    let state = board([80]);
    state = toggleFlag(state, 40);
    state = reveal(state, 0, createRng(1));
    expect(state.revealed[40]).toBe(false);
    expect(state.flagged[40]).toBe(true);
  });

  it("AC-G-mines-5 opens the unflagged neighbours of a number whose flags match", () => {
    // 地雷は 1。0 を開くと 0 は数字 1
    let state = reveal(board([1, 30]), 9, createRng(1));
    expect(adjacentMines(state, 9)).toBe(1);
    expect(reveal(state, 9, createRng(1))).toBe(state);
    state = toggleFlag(state, 1);
    state = reveal(state, 9, createRng(1));
    expect(state.revealed[0]).toBe(true);
    expect(state.revealed[10]).toBe(true);
    expect(state.revealed[18]).toBe(true);
    expect(state.revealed[1]).toBe(false);
    expect(state.phase).not.toBe("lost");
  });

  it("AC-G-mines-5 a wrong flag during a chord opens the mine", () => {
    let state = reveal(board([1, 30]), 9, createRng(1));
    state = toggleFlag(state, 0);
    state = reveal(state, 9, createRng(1));
    expect(state.phase).toBe("lost");
    expect(state.exploded).toBe(1);
  });

  it("AC-G-mines-6 ends without a record when a mine opens", () => {
    let state = reveal(board([1, 30]), 9, createRng(1));
    state = reveal(state, 30, createRng(1));
    expect(state).toMatchObject({ phase: "lost", exploded: 30 });
    expect(reveal(state, 2, createRng(1))).toBe(state);
    expect(toggleFlag(state, 2)).toBe(state);
  });

  it("AC-G-mines-6 wins after every safe cell, timing from the first reveal", () => {
    let state = createMines("easy");
    state = tick(state, 5_000);
    expect(state.elapsed).toBe(0);
    state = reveal(state, 40, createRng(3));
    state = tick(state, 1_200);
    const mines = state.mines ?? [];
    for (let cell = 0; cell < mines.length; cell++) {
      if (!mines[cell] && !state.revealed[cell]) state = reveal(state, cell, createRng(3));
    }
    expect(state.phase).toBe("won");
    expect(state.elapsed).toBe(1_200);
    expect(tick(state, 500).elapsed).toBe(1_200);
  });
});
