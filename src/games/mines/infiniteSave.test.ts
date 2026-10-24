import { describe, expect, it } from "vitest";
import { createFrontier, reveal, SECTOR, tick } from "./frontier.ts";
import {
  cellKey,
  createInfinite,
  isMine,
  reveal as revealInfinite,
  tick as tickInfinite,
  toggleFlag,
} from "./infinite.ts";
import { restoreFrontier, restoreProgress, saveFrontier, saveProgress } from "./infiniteSave.ts";

function played() {
  let game = revealInfinite(createInfinite(11), 0, 0);
  const closed = [...Array(9).keys()]
    .map((i) => ({ x: i - 4, y: -6 }))
    .find((cell) => !game.revealed.has(cellKey(cell.x, cell.y)));
  if (!closed) throw new Error("閉じたマスがない");
  game = tickInfinite(toggleFlag(game, closed.x, closed.y), 65_432);
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

  it("AC-G-mines-17 rejects a save made before the mines were laid out this way", () => {
    expect(restoreProgress({ ...saveProgress(played()), version: 1 })).toBeNull();
    expect(restoreFrontier({ ...saveFrontier(explored()), version: 1 })).toBeNull();
  });

  it("AC-G-mines-17 rejects anything it cannot read back", () => {
    const state = saveProgress(played());
    for (const broken of [
      null,
      "save",
      {},
      { ...state, version: state.version + 1 },
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

function explored() {
  let game = reveal(createFrontier(21), 3, 3);
  for (let y = 0; y < SECTOR; y++) {
    for (let x = 0; x < SECTOR; x++) {
      if (!isMine(game, x, y) && !game.revealed.has(cellKey(x, y))) game = reveal(game, x, y);
    }
  }
  const mine = [...Array(20).keys()]
    .map((i) => ({ x: i - 10, y: -12 }))
    .find((cell) => isMine(game, cell.x, cell.y));
  if (!mine) throw new Error("地雷がない");
  game = tick(reveal(game, mine.x, mine.y), 12_345);
  return { game, center: { x: 1.5, y: -2.25 }, span: 23, cursor: { x: 4, y: 4 } };
}

describe("frontier save", () => {
  it("AC-G-mines-23 restores the same board with its stepped-on mines, time, view and cursor", () => {
    const progress = explored();
    expect(progress.game.secured.has("0,0")).toBe(true);
    expect(progress.game.hits.size).toBe(1);
    const restored = restoreFrontier(JSON.parse(JSON.stringify(saveFrontier(progress))));
    expect(restored).toEqual(progress);
  });

  it("AC-G-mines-23 works the sectors out again instead of keeping them", () => {
    const state = saveFrontier(explored());
    expect(state.hits).toHaveLength(2);
    expect(Object.keys(state)).not.toContain("secured");
    expect(Object.keys(state)).not.toContain("lost");
  });

  it("AC-G-mines-23 rejects anything it cannot read back", () => {
    const state = saveFrontier(explored());
    const { hits: _, ...withoutHits } = state;
    for (const broken of [
      null,
      withoutHits,
      saveProgress(played()),
      { ...state, version: state.version + 1 },
      { ...state, hits: [1, 2, 3] },
      { ...state, hits: [0.5, 0] },
      { ...state, revealed: "0,0" },
      { ...state, span: Number.NaN },
    ]) {
      expect(restoreFrontier(broken)).toBeNull();
    }
  });
});
