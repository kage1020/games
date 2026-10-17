import { describe, expect, it } from "vitest";
import { OPPOSITE } from "@/sdk/grid.ts";
import { createRng } from "@/sdk/rng.ts";
import {
  claimEnclosed,
  countCells,
  createTerritory,
  DURATION_MS,
  playerCount,
  SIZE,
  STEP_MS,
  score,
  steer,
  step,
  type TerritoryState,
  TOTAL_STEPS,
} from "./logic.ts";

const at = (x: number, y: number) => y * SIZE + x;

function emptyBoard(): (number | null)[] {
  return Array.from({ length: SIZE * SIZE }, () => null);
}

/** (x0,y0)-(x1,y1) の外周を player のマスにする */
function ring(
  owners: (number | null)[],
  player: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (let x = x0; x <= x1; x++) {
    owners[at(x, y0)] = player;
    owners[at(x, y1)] = player;
  }
  for (let y = y0; y <= y1; y++) {
    owners[at(x0, y)] = player;
    owners[at(x1, y)] = player;
  }
}

describe("territory", () => {
  it("AC-G-territory-1 has a 16×16 board and 2 to 4 players by mode", () => {
    expect(SIZE).toBe(16);
    expect(playerCount("p2")).toBe(2);
    expect(playerCount("p3")).toBe(3);
    expect(playerCount("p4")).toBe(4);
    for (const count of [2, 3, 4]) {
      const state = createTerritory(count);
      expect(state.owners).toHaveLength(SIZE * SIZE);
      expect(state.players).toHaveLength(count);
      expect(state.players[0]?.cpu).toBe(false);
      expect(state.players.slice(1).every((player) => player.cpu)).toBe(true);
    }
  });

  it("AC-G-territory-1 gives each player a 2×2 block in its own corner", () => {
    const state = createTerritory(4);
    const corners = new Set<string>();
    state.players.forEach((player, index) => {
      expect(countCells(state.owners, index)).toBe(4);
      expect(state.owners[at(player.x, player.y)]).toBe(index);
      const cells = state.owners.flatMap((owner, cell) => (owner === index ? [cell] : []));
      const xs = cells.map((cell) => cell % SIZE);
      const ys = cells.map((cell) => Math.floor(cell / SIZE));
      expect(Math.max(...xs) - Math.min(...xs)).toBe(1);
      expect(Math.max(...ys) - Math.min(...ys)).toBe(1);
      const cornerX =
        Math.min(...xs) === 0 ? "left" : Math.max(...xs) === SIZE - 1 ? "right" : "middle";
      const cornerY =
        Math.min(...ys) === 0 ? "top" : Math.max(...ys) === SIZE - 1 ? "bottom" : "middle";
      corners.add(`${cornerY}-${cornerX}`);
    });
    expect([...corners].sort()).toEqual(["bottom-left", "bottom-right", "top-left", "top-right"]);
  });

  it("AC-G-territory-2 moves everyone one cell and claims the cells they enter", () => {
    const state = createTerritory(4);
    const next = step(state, createRng(1));
    next.players.forEach((player, index) => {
      const before = state.players[index];
      if (!before) throw new Error("missing player");
      expect(Math.abs(player.x - before.x) + Math.abs(player.y - before.y)).toBe(1);
      expect(next.owners[at(player.x, player.y)]).toBe(index);
    });
    const you = next.players[0];
    expect(you && { x: you.x, y: you.y }).toEqual({ x: 2, y: 1 });
  });

  it("AC-G-territory-2 does not move off the board", () => {
    const state = createTerritory(2);
    const facingWall = steer(
      { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, x: 0, y: 5 } : p)) },
      "left",
    );
    const next = step(facingWall, createRng(2));
    expect(next.players[0]).toMatchObject({ x: 0, y: 5 });
  });

  it("AC-G-territory-2 lets the player steer any way, including back", () => {
    const state = createTerritory(2);
    const back = step(steer(state, "left"), createRng(3));
    expect(back.players[0]).toMatchObject({ x: 0, y: 1 });
  });

  it("AC-G-territory-3 takes cells enclosed by the player's own cells", () => {
    const owners = emptyBoard();
    ring(owners, 0, 4, 4, 8, 8);
    owners[at(6, 6)] = 1;
    const claimed = claimEnclosed(owners, 0);
    for (let y = 5; y <= 7; y++) {
      for (let x = 5; x <= 7; x++) expect(claimed[at(x, y)]).toBe(0);
    }
    expect(claimed[at(3, 3)]).toBeNull();
  });

  it("AC-G-territory-3 does not take regions that reach the outside", () => {
    const owners = emptyBoard();
    ring(owners, 0, 4, 4, 8, 8);
    owners[at(8, 6)] = null;
    expect(countCells(claimEnclosed(owners, 0), 0)).toBe(countCells(owners, 0));
    const corner = emptyBoard();
    for (let i = 0; i <= 4; i++) {
      corner[at(4, i)] = 0;
      corner[at(i, 4)] = 0;
    }
    expect(countCells(claimEnclosed(corner, 0), 0)).toBe(9);
  });

  it("AC-G-territory-3 encloses when a step closes the loop", () => {
    const base = createTerritory(2);
    const owners = [...base.owners];
    ring(owners, 0, 4, 4, 8, 8);
    owners[at(8, 6)] = null;
    const state: TerritoryState = {
      ...base,
      owners,
      players: base.players.map((p, i) => (i === 0 ? { ...p, x: 8, y: 5, direction: "down" } : p)),
    };
    const next = step(state, createRng(4));
    expect(next.owners[at(6, 6)]).toBe(0);
    expect(next.owners[at(5, 5)]).toBe(0);
  });

  it("AC-G-territory-4 keeps CPUs on the board and never turns them straight back", () => {
    let state = createTerritory(4);
    const rng = createRng(5);
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const next = step(state, rng);
      for (let p = 1; p < next.players.length; p++) {
        const before = state.players[p];
        const after = next.players[p];
        if (!before || !after) throw new Error("missing player");
        expect(after.x).toBeGreaterThanOrEqual(0);
        expect(after.y).toBeGreaterThanOrEqual(0);
        expect(after.x).toBeLessThan(SIZE);
        expect(after.y).toBeLessThan(SIZE);
        expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBe(1);
        expect(after.direction).not.toBe(OPPOSITE[before.direction]);
      }
      state = next;
    }
  });

  it("AC-G-territory-4 is decided by the seed", () => {
    const run = (seed: number) => {
      let state = createTerritory(3);
      const rng = createRng(seed);
      for (let i = 0; i < 50; i++) state = step(state, rng);
      return state.owners;
    };
    expect(run(7)).toEqual(run(7));
  });

  it("AC-G-territory-5 ends after 60 seconds with the player's cells as the record", () => {
    expect(TOTAL_STEPS * STEP_MS).toBe(DURATION_MS);
    expect(DURATION_MS).toBe(60_000);
    let state = createTerritory(2);
    const rng = createRng(6);
    for (let i = 0; i < TOTAL_STEPS - 1; i++) state = step(state, rng);
    expect(state.over).toBe(false);
    state = step(state, rng);
    expect(state.over).toBe(true);
    expect(state.stepsLeft).toBe(0);
    expect(step(state, rng)).toBe(state);
    expect(steer(state, "up")).toBe(state);
    expect(score(state)).toBe(countCells(state.owners, 0));
  });
});
