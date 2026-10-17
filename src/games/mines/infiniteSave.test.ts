import { describe, expect, it } from "vitest";
import { cellKey, createInfinite, reveal, tick, toggleFlag } from "./infinite.ts";
import { restoreProgress, saveProgress } from "./infiniteSave.ts";

function played() {
  let game = reveal(createInfinite(11), 0, 0);
  const closed = [...Array(9).keys()]
    .map((i) => ({ x: i - 4, y: -6 }))
    .find((cell) => !game.revealed.has(cellKey(cell.x, cell.y)));
  if (!closed) throw new Error("閉じたマスがない");
  game = tick(toggleFlag(game, closed.x, closed.y), 65_432);
  return { game, center: { x: 3.25, y: -1.5 }, span: 17, cursor: { x: 2, y: -4 } };
}

describe("infinite save", () => {
  it("AC-G-mines-17 restores the same board, time, view and cursor", () => {
    const progress = played();
    const restored = restoreProgress(JSON.parse(JSON.stringify(saveProgress(progress))));
    expect(restored).toEqual(progress);
  });

  it("AC-G-mines-17 keeps opened cells as coordinates and works the numbers out again", () => {
    const progress = played();
    const state = saveProgress(progress);
    expect(state.revealed).toHaveLength(progress.game.revealed.size * 2);
    expect(state.flagged).toHaveLength(2);
  });

  it("AC-G-mines-17 keeps the restored span inside the zoom range", () => {
    const state = { ...saveProgress(played()), span: 999 };
    expect(restoreProgress(state)?.span).toBe(40);
  });

  it("AC-G-mines-17 rejects anything it cannot read back", () => {
    const state = saveProgress(played());
    for (const broken of [
      null,
      "save",
      {},
      { ...state, version: 2 },
      { ...state, seed: "11" },
      { ...state, start: [0] },
      { ...state, revealed: [1, 2, 3] },
      { ...state, revealed: [0.5, 0] },
      { ...state, flagged: "0,0" },
      { ...state, elapsed: -1 },
      { ...state, center: [0, "0"] },
      { ...state, cursor: [0, 0.5] },
      { ...state, span: null },
    ]) {
      expect(restoreProgress(broken)).toBeNull();
    }
  });
});
