import { describe, expect, it } from "vitest";
import {
  canToggleFlag,
  createFrontier,
  endFrontier,
  type FrontierState,
  reveal,
  SECTOR,
  sectorAt,
  tick,
  toggleFlag,
} from "./frontier.ts";
import {
  type Cell,
  cellKey,
  createInfinite,
  isMine,
  neighbors,
  reveal as open,
} from "./infinite.ts";

const started = (seed: number, x = 3, y = 3): FrontierState => reveal(createFrontier(seed), x, y);

/** 区画のマス。区画はキー（"sx,sy"）で渡す */
function sectorCells(sector: string): Cell[] {
  const [sx = 0, sy = 0] = sector.split(",").map(Number);
  const cells: Cell[] = [];
  for (let y = sy * SECTOR; y < (sy + 1) * SECTOR; y++) {
    for (let x = sx * SECTOR; x < (sx + 1) * SECTOR; x++) cells.push({ x, y });
  }
  return cells;
}

const isOpen = (state: FrontierState, cell: Cell) => state.revealed.has(cellKey(cell.x, cell.y));

/** 区画の地雷でないマスを 1 つずつ開いていく */
function openSector(state: FrontierState, sector: string): FrontierState {
  let current = state;
  for (const cell of sectorCells(sector)) {
    if (isMine(current, cell.x, cell.y) || isOpen(current, cell)) continue;
    current = reveal(current, cell.x, cell.y);
  }
  return current;
}

/** 開いていない地雷を、start から近い順に探す */
function closedMine(state: FrontierState, from: Cell): Cell {
  for (let r = 1; ; r++) {
    for (let x = from.x - r; x <= from.x + r; x++) {
      for (let y = from.y - r; y <= from.y + r; y++) {
        if (isMine(state, x, y)) return { x, y };
      }
    }
  }
}

describe("frontier mines", () => {
  it("AC-G-mines-18 lays out the same board as infinite and opens it the same way", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const frontier = started(seed, seed, -seed);
      const infinite = open(createInfinite(seed), seed, -seed);
      expect(frontier.phase).toBe("playing");
      expect(frontier.revealed).toEqual(infinite.revealed);
      for (let x = -10; x < 10; x++) {
        for (let y = -10; y < 10; y++) expect(isMine(frontier, x, y)).toBe(isMine(infinite, x, y));
      }
    }
  });

  it("AC-G-mines-18 splits the board into 8×8 sectors by position alone", () => {
    expect(SECTOR).toBe(8);
    expect(sectorAt(0, 0)).toBe("0,0");
    expect(sectorAt(7, 7)).toBe("0,0");
    expect(sectorAt(8, 0)).toBe("1,0");
    expect(sectorAt(-1, -1)).toBe("-1,-1");
    expect(sectorAt(-8, 15)).toBe("-1,1");
    expect(sectorAt(-9, 16)).toBe("-2,2");
  });

  it("AC-G-mines-19 secures a sector once all its safe cells are open, and flags its mines", () => {
    let state = started(21);
    for (const cell of sectorCells("0,0")) {
      if (isMine(state, cell.x, cell.y) || isOpen(state, cell)) continue;
      expect(state.secured.has("0,0")).toBe(false);
      state = reveal(state, cell.x, cell.y);
    }
    expect(state.secured.has("0,0")).toBe(true);
    const mines = sectorCells("0,0").filter((cell) => isMine(state, cell.x, cell.y));
    expect(mines.length).toBeGreaterThan(0);
    for (const mine of mines) {
      expect(state.flagged.has(cellKey(mine.x, mine.y))).toBe(true);
      expect(canToggleFlag(state, mine.x, mine.y)).toBe(false);
      expect(toggleFlag(state, mine.x, mine.y)).toBe(state);
      expect(reveal(state, mine.x, mine.y)).toBe(state);
    }
  });

  it("AC-G-mines-19 does not secure a sector while a flag covers one of its safe cells", () => {
    const state = started(21);
    const safe = sectorCells("0,0").find(
      (cell) => !isMine(state, cell.x, cell.y) && !isOpen(state, cell),
    );
    if (!safe) throw new Error("閉じた安全なマスがない");
    const flagged = openSector(toggleFlag(state, safe.x, safe.y), "0,0");
    expect(flagged.secured.has("0,0")).toBe(false);
    expect(openSector(toggleFlag(flagged, safe.x, safe.y), "0,0").secured.has("0,0")).toBe(true);
  });

  it("AC-G-mines-20 keeps playing after a mine, and the mine's sector can never be secured", () => {
    const state = started(5);
    const mine = closedMine(state, { x: 3, y: 3 });
    const sector = sectorAt(mine.x, mine.y);
    const hit = reveal(state, mine.x, mine.y);
    expect(hit.phase).toBe("playing");
    expect(hit.hits).toEqual(new Set([cellKey(mine.x, mine.y)]));
    expect(hit.lost).toEqual(new Set([sector]));
    expect(hit.revealed).toEqual(state.revealed);
    expect(reveal(hit, mine.x, mine.y)).toBe(hit);
    expect(canToggleFlag(hit, mine.x, mine.y)).toBe(false);
    expect(toggleFlag(hit, mine.x, mine.y)).toBe(hit);

    const cleared = openSector(hit, sector);
    for (const cell of sectorCells(sector)) {
      if (!isMine(cleared, cell.x, cell.y)) expect(isOpen(cleared, cell)).toBe(true);
    }
    expect(cleared.secured.has(sector)).toBe(false);
    expect(cleared.lost.has(sector)).toBe(true);
  });

  it("AC-G-mines-20 counts a stepped-on mine like a flag around a number", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const state = started(seed);
      for (const [key, count] of state.revealed) {
        const [x = 0, y = 0] = key.split(",").map(Number);
        const around = neighbors(x, y);
        const mines = around.filter((cell) => isMine(state, cell.x, cell.y));
        const safe = around.filter(
          (cell) => !isMine(state, cell.x, cell.y) && !isOpen(state, cell),
        );
        const [stepped, ...others] = mines;
        if (count === 0 || !stepped || safe.length === 0) continue;

        let current = reveal(state, stepped.x, stepped.y);
        for (const mine of others) current = toggleFlag(current, mine.x, mine.y);
        const chorded = reveal(current, x, y);
        expect(chorded.hits.size).toBe(1);
        for (const cell of safe) expect(isOpen(chorded, cell)).toBe(true);
        return;
      }
    }
    throw new Error("試せる数字のマスがない");
  });

  it("AC-G-mines-20 steps on every mine a number opens, and still opens its safe cells", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const state = started(seed);
      for (const [key, count] of state.revealed) {
        const [x = 0, y = 0] = key.split(",").map(Number);
        const around = neighbors(x, y);
        const mines = around.filter((cell) => isMine(state, cell.x, cell.y));
        const safe = around.filter(
          (cell) => !isMine(state, cell.x, cell.y) && !isOpen(state, cell),
        );
        if (count < 2 || safe.length <= count) continue;

        const wrong = safe.slice(0, count);
        let flagged = state;
        for (const cell of wrong) flagged = toggleFlag(flagged, cell.x, cell.y);
        const chorded = reveal(flagged, x, y);
        expect(chorded.phase).toBe("playing");
        expect(chorded.hits).toEqual(new Set(mines.map((cell) => cellKey(cell.x, cell.y))));
        expect(chorded.lost).toEqual(new Set(mines.map((cell) => sectorAt(cell.x, cell.y))));
        for (const cell of safe.slice(count)) expect(isOpen(chorded, cell)).toBe(true);
        for (const cell of wrong) expect(isOpen(chorded, cell)).toBe(false);
        return;
      }
    }
    throw new Error("試せる数字のマスがない");
  });

  it("AC-G-mines-22 ends only after the first open, and nothing changes once it ends", () => {
    const ready = createFrontier(3);
    expect(endFrontier(ready)).toBe(ready);
    const ended = endFrontier(started(3));
    expect(ended.phase).toBe("ended");
    expect(reveal(ended, 40, 40)).toBe(ended);
    expect(toggleFlag(ended, 40, 40)).toBe(ended);
    expect(canToggleFlag(ended, 40, 40)).toBe(false);
    expect(tick(ended, 500)).toBe(ended);
  });

  it("AC-G-mines-22 counts time only while playing", () => {
    const ready = createFrontier(2);
    expect(tick(ready, 500)).toBe(ready);
    const playing = started(2);
    expect(tick(tick(playing, 400), 600).elapsed).toBe(1000);
  });
});
