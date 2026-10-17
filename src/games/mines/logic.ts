import type { Rng } from "@/sdk/rng.ts";

export const MODES = {
  easy: { cols: 9, rows: 9, mines: 10 },
  normal: { cols: 16, rows: 16, mines: 40 },
} as const;

export type MinesMode = keyof typeof MODES;
export type MinesPhase = "ready" | "playing" | "won" | "lost";

export interface MinesState {
  cols: number;
  rows: number;
  mineCount: number;
  /** null は最初に開くまで地雷を置いていない状態 */
  mines: boolean[] | null;
  revealed: boolean[];
  flagged: boolean[];
  phase: MinesPhase;
  exploded: number | null;
  /** 最初に開いてからの時間（ミリ秒） */
  elapsed: number;
}

export function isMinesMode(mode: string): mode is MinesMode {
  return mode in MODES;
}

export function createMines(mode: MinesMode): MinesState {
  const { cols, rows, mines } = MODES[mode];
  const cells = cols * rows;
  return {
    cols,
    rows,
    mineCount: mines,
    mines: null,
    revealed: Array.from({ length: cells }, () => false),
    flagged: Array.from({ length: cells }, () => false),
    phase: "ready",
    exploded: null,
    elapsed: 0,
  };
}

/** 周り 8 マス */
export function neighbors8(state: Pick<MinesState, "cols" | "rows">, index: number): number[] {
  const x = index % state.cols;
  const y = Math.floor(index / state.cols);
  const result: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < state.cols && ny < state.rows)
        result.push(ny * state.cols + nx);
    }
  }
  return result;
}

export function adjacentMines(state: MinesState, index: number): number {
  return neighbors8(state, index).filter((cell) => state.mines?.[cell]).length;
}

export function flagsLeft(state: MinesState): number {
  return state.mineCount - state.flagged.filter(Boolean).length;
}

/** 決めた位置に地雷を置いて始める */
export function placeMines(state: MinesState, positions: number[]): MinesState {
  const mines = state.revealed.map(() => false);
  for (const position of positions) mines[position] = true;
  return { ...state, mines, phase: "playing" };
}

function randomMines(state: MinesState, first: number, rng: Rng): number[] {
  const safe = new Set([first, ...neighbors8(state, first)]);
  const candidates = state.revealed.map((_, cell) => cell).filter((cell) => !safe.has(cell));
  return rng.shuffle(candidates).slice(0, state.mineCount);
}

function isWon(state: MinesState, revealed: boolean[]): boolean {
  return revealed.every((open, cell) => open || state.mines?.[cell] === true);
}

/** cells を開き、0 のマスからはつながる 0 とその縁まで広げる。旗のマスは開かない */
function open(state: MinesState, cells: number[]): MinesState {
  const revealed = [...state.revealed];
  const queue = cells.filter((cell) => !revealed[cell] && !state.flagged[cell]);
  for (const cell of queue) {
    if (state.mines?.[cell]) {
      return { ...state, revealed, phase: "lost", exploded: cell };
    }
  }
  while (queue.length > 0) {
    const cell = queue.shift();
    if (cell === undefined || revealed[cell]) continue;
    revealed[cell] = true;
    if (adjacentMines(state, cell) === 0) {
      for (const next of neighbors8(state, cell)) {
        if (!revealed[next] && !state.flagged[next]) queue.push(next);
      }
    }
  }
  return { ...state, revealed, phase: isWon(state, revealed) ? "won" : state.phase };
}

/**
 * マスを開く。最初の 1 回でそのマスと周りを避けて地雷を置く。
 * 開いた数字のマスなら、周りの旗が数字と同じときに旗のない周りを開く。
 */
export function reveal(state: MinesState, index: number, rng: Rng): MinesState {
  if (state.phase === "won" || state.phase === "lost") return state;
  if (state.flagged[index]) return state;
  const current = state.mines === null ? placeMines(state, randomMines(state, index, rng)) : state;
  if (!current.revealed[index]) return open(current, [index]);

  const count = adjacentMines(current, index);
  const around = neighbors8(current, index);
  const flags = around.filter((cell) => current.flagged[cell]).length;
  const closed = around.filter((cell) => !current.revealed[cell] && !current.flagged[cell]);
  if (count === 0 || flags !== count || closed.length === 0) return state;
  return open(current, closed);
}

export function toggleFlag(state: MinesState, index: number): MinesState {
  if (state.phase === "won" || state.phase === "lost" || state.revealed[index]) return state;
  const flagged = [...state.flagged];
  flagged[index] = !flagged[index];
  return { ...state, flagged };
}

export function tick(state: MinesState, dt: number): MinesState {
  return state.phase === "playing" ? { ...state, elapsed: state.elapsed + dt } : state;
}
