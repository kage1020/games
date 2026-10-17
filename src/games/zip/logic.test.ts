import { describe, expect, it } from "vitest";
import { neighbors4 } from "@/sdk/grid.ts";
import { createRng } from "@/sdk/rng.ts";
import {
  BOARD_COUNT,
  CHECKPOINTS,
  createZip,
  generateBoard,
  isSolved,
  moveTo,
  nextBoard,
  SIZES,
  step,
  tick,
  undo,
  type ZipBoard,
  type ZipState,
} from "./logic.ts";

function isAdjacent(board: ZipBoard, a: number, b: number): boolean {
  return neighbors4(a, board.size, board.size).includes(b);
}

/** 盤の解（生成に使った経路）を最後までたどる */
function solve(state: ZipState): ZipState {
  let current = state;
  for (const cell of current.board.solution.slice(current.path.length)) {
    current = moveTo(current, cell);
  }
  return current;
}

/** 番号のない 2 つの隣り合うマスを線として持つ、手で作った 3×3 の盤 */
const MANUAL: ZipBoard = {
  size: 3,
  // 0 1 2
  // 3 4 5
  // 6 7 8
  // 解：0 1 2 5 4 3 6 7 8、番号は 0=1, 4=2, 8=3
  checkpoints: [1, null, null, null, 2, null, null, null, 3],
  solution: [0, 1, 2, 5, 4, 3, 6, 7, 8],
};

function manualState(): ZipState {
  return { ...createZip(createRng(1)), board: MANUAL, path: [0] };
}

describe("zip board", () => {
  it("AC-G-zip-1 generates an N×N board with 1..K that a full path visits in order", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = createRng(seed);
      for (const [i, size] of SIZES.entries()) {
        const count = CHECKPOINTS[i] ?? 0;
        const board = generateBoard(size, count, rng);
        expect(board.size).toBe(size);
        expect(board.checkpoints).toHaveLength(size * size);
        const numbers = board.checkpoints.filter((n): n is number => n !== null);
        expect(numbers.sort((a, b) => a - b)).toEqual(
          Array.from({ length: count }, (_, k) => k + 1),
        );
        const { solution } = board;
        expect(new Set(solution).size).toBe(size * size);
        for (let k = 1; k < solution.length; k++) {
          expect(isAdjacent(board, solution[k - 1] ?? -1, solution[k] ?? -1)).toBe(true);
        }
        const order = solution
          .map((cell) => board.checkpoints[cell])
          .filter((n): n is number => n != null);
        expect(order).toEqual(Array.from({ length: count }, (_, k) => k + 1));
        expect(board.checkpoints[solution[0] ?? -1]).toBe(1);
        expect(board.checkpoints[solution.at(-1) ?? -1]).toBe(count);
      }
    }
  });

  it("AC-G-zip-1 is decided by the seed", () => {
    expect(generateBoard(6, 7, createRng(9))).toEqual(generateBoard(6, 7, createRng(9)));
  });
});

describe("zip moves", () => {
  it("AC-G-zip-2 always starts at 1 and extends only to an adjacent unvisited cell", () => {
    const state = createZip(createRng(2));
    expect(state.path).toHaveLength(1);
    expect(state.board.checkpoints[state.path[0] ?? -1]).toBe(1);

    const manual = manualState();
    expect(moveTo(manual, 1).path).toEqual([0, 1]);
    expect(moveTo(manual, 2)).toBe(manual);
    expect(moveTo(manual, 3).path).toEqual([0, 3]);
    const longer = moveTo(moveTo(manual, 1), 2);
    expect(longer.path).toEqual([0, 1, 2]);
  });

  it("AC-G-zip-3 enters a numbered cell only when it is the next number", () => {
    const manual = manualState();
    const atOne = moveTo(manual, 1);
    expect(moveTo(atOne, 4).path).toEqual([0, 1, 4]);
    const early = moveTo(moveTo(moveTo(moveTo(manual, 3), 6), 7), 8);
    expect(early.path).toEqual([0, 3, 6, 7]);
  });

  it("AC-G-zip-3 cannot extend from the last number", () => {
    let state = manualState();
    for (const cell of [3, 4, 5, 8]) state = moveTo(state, cell);
    expect(state.path).toEqual([0, 3, 4, 5, 8]);
    expect(moveTo(state, 7)).toBe(state);
    expect(step(state, "left")).toBe(state);
  });

  it("AC-G-zip-4 retracts the last cell when moving back to the previous one", () => {
    let state = manualState();
    for (const cell of [1, 2, 5]) state = moveTo(state, cell);
    expect(moveTo(state, 2).path).toEqual([0, 1, 2]);
    expect(step(state, "up").path).toEqual([0, 1, 2]);
    expect(undo(state).path).toEqual([0, 1, 2]);
    expect(undo(manualState()).path).toEqual([0]);
  });

  it("AC-G-zip-4 shrinks the path back to a chosen cell in the middle", () => {
    let state = manualState();
    for (const cell of [1, 2, 5, 4]) state = moveTo(state, cell);
    expect(moveTo(state, 1).path).toEqual([0, 1]);
    expect(moveTo(state, 0).path).toEqual([0]);
  });

  it("AC-G-zip-5 clears the board after every cell ending at K", () => {
    let state = manualState();
    for (const cell of MANUAL.solution.slice(1, -1)) state = moveTo(state, cell);
    expect(isSolved(state.board, state.path)).toBe(false);
    expect(state.phase).toBe("playing");
    state = moveTo(state, 8);
    expect(isSolved(state.board, state.path)).toBe(true);
    expect(state.phase).toBe("cleared");
    expect(moveTo(state, 7)).toBe(state);
  });
});

describe("zip run", () => {
  it("AC-G-zip-6 plays five boards of sizes 4, 5, 5, 6, 6", () => {
    const rng = createRng(3);
    let state = createZip(rng);
    const sizes: number[] = [];
    for (let i = 0; i < BOARD_COUNT; i++) {
      sizes.push(state.board.size);
      state = solve(state);
      if (state.phase === "cleared") state = nextBoard(state, rng);
    }
    expect(sizes).toEqual([4, 5, 5, 6, 6]);
    expect(state.phase).toBe("done");
    expect(state.stage).toBe(BOARD_COUNT - 1);
  });

  it("AC-G-zip-6 adds up elapsed time only while a board is being played", () => {
    const rng = createRng(4);
    let state = tick(createZip(rng), 1_000);
    expect(state.elapsed).toBe(1_000);
    state = solve(state);
    state = tick(state, 500);
    expect(state.elapsed).toBe(1_000);
    state = tick(nextBoard(state, rng), 250);
    expect(state.elapsed).toBe(1_250);
    while (state.phase !== "done") {
      state = solve(state);
      if (state.phase === "cleared") state = tick(nextBoard(state, rng), 100);
    }
    expect(state.elapsed).toBe(1_550);
    expect(tick(state, 1_000).elapsed).toBe(1_550);
  });
});
