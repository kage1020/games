import type { Rng } from "@/sdk/rng.ts";

export const COLS = 8;
export const ROWS = 5;
export const START_LEVEL = 4;
export const MAX_LEVEL = COLS * ROWS;
export const MAX_MISSES = 3;

export type Phase = "show" | "hidden" | "cleared" | "missed" | "over";

export interface MemoryState {
  level: number;
  misses: number;
  /** マスごとの数。null は数のないマス */
  cells: (number | null)[];
  /** 次に押す数。これより小さい数は押し終わっている */
  next: number;
  phase: Phase;
  /** クリアした最大のレベル。これが記録 */
  best: number;
  wrongCell: number | null;
}

function layout(level: number, rng: Rng): (number | null)[] {
  const cells: (number | null)[] = Array.from({ length: COLS * ROWS }, () => null);
  rng
    .shuffle(cells.map((_, i) => i))
    .slice(0, level)
    .forEach((cell, i) => {
      cells[cell] = i + 1;
    });
  return cells;
}

function round(level: number, misses: number, best: number, rng: Rng): MemoryState {
  return {
    level,
    misses,
    best,
    cells: layout(level, rng),
    next: 1,
    phase: "show",
    wrongCell: null,
  };
}

export function createMemory(rng: Rng): MemoryState {
  return round(START_LEVEL, 0, 0, rng);
}

export function press(state: MemoryState, index: number): MemoryState {
  if (state.phase !== "show" && state.phase !== "hidden") return state;
  const value = state.cells[index];
  if (value == null || value < state.next) return state;
  if (value !== state.next) {
    const misses = state.misses + 1;
    return { ...state, misses, wrongCell: index, phase: misses >= MAX_MISSES ? "over" : "missed" };
  }
  if (value === state.level) {
    return {
      ...state,
      next: value + 1,
      best: state.level,
      phase: state.level >= MAX_LEVEL ? "over" : "cleared",
    };
  }
  return { ...state, next: value + 1, phase: "hidden" };
}

/** クリアかミスのあと、次の配置に進む */
export function advance(state: MemoryState, rng: Rng): MemoryState {
  if (state.phase === "cleared") return round(state.level + 1, state.misses, state.best, rng);
  if (state.phase === "missed") return round(state.level, state.misses, state.best, rng);
  return state;
}
