import { DIRECTIONS, type Direction, inBounds, neighbors4 } from "@/sdk/grid.ts";
import type { Rng } from "@/sdk/rng.ts";

export const SIZES = [4, 5, 5, 6, 6] as const;
export const CHECKPOINTS = [4, 5, 6, 6, 7] as const;
export const BOARD_COUNT = SIZES.length;

export interface ZipBoard {
  size: number;
  /** マスごとの番号。null は番号のないマス */
  checkpoints: (number | null)[];
  /** 生成に使った道。番号順にすべてのマスを通る */
  solution: number[];
}

export type ZipPhase = "playing" | "cleared" | "done";

export interface ZipState {
  /** 0 から数えた面 */
  stage: number;
  board: ZipBoard;
  /** 1 のマスから始まる、いまの道 */
  path: number[];
  /** 遊んでいた時間の合計（ミリ秒） */
  elapsed: number;
  phase: ZipPhase;
}

/** 蛇行する道から始め、端を付け替える（backbite）ことで偏りのないハミルトン路を作る */
function hamiltonianPath(size: number, rng: Rng): number[] {
  let path: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let i = 0; i < size; i++) {
      const x = y % 2 === 0 ? i : size - 1 - i;
      path.push(y * size + x);
    }
  }
  const moves = size * size * 20;
  for (let n = 0; n < moves; n++) {
    const fromStart = rng.next() < 0.5;
    const end = fromStart ? path[0] : path.at(-1);
    const beside = fromStart ? path[1] : path.at(-2);
    if (end === undefined) break;
    const candidates = neighbors4(end, size, size).filter((cell) => cell !== beside);
    if (candidates.length === 0) continue;
    const j = path.indexOf(rng.pick(candidates));
    path = fromStart
      ? [...path.slice(0, j).reverse(), ...path.slice(j)]
      : [...path.slice(0, j + 1), ...path.slice(j + 1).reverse()];
  }
  return path;
}

export function generateBoard(size: number, count: number, rng: Rng): ZipBoard {
  const solution = hamiltonianPath(size, rng);
  const last = solution.length - 1;
  const interior = rng
    .shuffle(Array.from({ length: last - 1 }, (_, i) => i + 1))
    .slice(0, count - 2);
  const positions = [0, ...interior, last].sort((a, b) => a - b);
  const checkpoints: (number | null)[] = Array.from({ length: size * size }, () => null);
  positions.forEach((position, i) => {
    const cell = solution[position];
    if (cell !== undefined) checkpoints[cell] = i + 1;
  });
  return { size, checkpoints, solution };
}

function startOf(board: ZipBoard): number[] {
  return [board.checkpoints.indexOf(1)];
}

function boardAt(stage: number, rng: Rng): ZipBoard {
  return generateBoard(SIZES[stage] ?? 6, CHECKPOINTS[stage] ?? 7, rng);
}

export function createZip(rng: Rng): ZipState {
  const board = boardAt(0, rng);
  return { stage: 0, board, path: startOf(board), elapsed: 0, phase: "playing" };
}

function checkpointCount(board: ZipBoard): number {
  return board.checkpoints.reduce((max: number, n) => (n !== null && n > max ? n : max), 0);
}

/** 道が次に入るべき番号 */
export function nextCheckpoint(board: ZipBoard, path: number[]): number {
  return path.filter((cell) => board.checkpoints[cell] != null).length + 1;
}

export function isSolved(board: ZipBoard, path: number[]): boolean {
  const last = path.at(-1);
  return (
    path.length === board.size * board.size &&
    last !== undefined &&
    board.checkpoints[last] === checkpointCount(board)
  );
}

function canExtend(board: ZipBoard, path: number[], cell: number): boolean {
  const head = path.at(-1);
  if (head === undefined || path.includes(cell)) return false;
  if (!neighbors4(head, board.size, board.size).includes(cell)) return false;
  if (board.checkpoints[head] === checkpointCount(board)) return false;
  const number = board.checkpoints[cell];
  return number == null || number === nextCheckpoint(board, path);
}

function withPath(state: ZipState, path: number[]): ZipState {
  if (!isSolved(state.board, path)) return { ...state, path };
  return { ...state, path, phase: state.stage >= BOARD_COUNT - 1 ? "done" : "cleared" };
}

/**
 * 指やクリックで選んだマスへ道を動かす。1 つ前のマスなら最後を取り消し、
 * 道の途中のマスならそこまで縮め、隣の空いたマスなら伸ばす。
 */
export function moveTo(state: ZipState, cell: number): ZipState {
  if (state.phase !== "playing") return state;
  const { path } = state;
  if (cell === path.at(-1)) return state;
  const index = path.indexOf(cell);
  if (index >= 0) return withPath(state, path.slice(0, index + 1));
  if (!canExtend(state.board, path, cell)) return state;
  return withPath(state, [...path, cell]);
}

/** キーの向きへ 1 マス。1 つ前のマスへ向かうなら取り消す */
export function step(state: ZipState, direction: Direction): ZipState {
  const head = state.path.at(-1);
  if (state.phase !== "playing" || head === undefined) return state;
  const { size } = state.board;
  const x = (head % size) + DIRECTIONS[direction].dx;
  const y = Math.floor(head / size) + DIRECTIONS[direction].dy;
  if (!inBounds(x, y, size, size)) return state;
  const target = y * size + x;
  if (target === state.path.at(-2)) return undo(state);
  if (!canExtend(state.board, state.path, target)) return state;
  return withPath(state, [...state.path, target]);
}

/** 最後の 1 マスを取り消す。1 のマスは残る */
export function undo(state: ZipState): ZipState {
  if (state.phase !== "playing" || state.path.length <= 1) return state;
  return withPath(state, state.path.slice(0, -1));
}

export function tick(state: ZipState, dt: number): ZipState {
  return state.phase === "playing" ? { ...state, elapsed: state.elapsed + dt } : state;
}

export function nextBoard(state: ZipState, rng: Rng): ZipState {
  if (state.phase !== "cleared") return state;
  const stage = state.stage + 1;
  const board = boardAt(stage, rng);
  return { ...state, stage, board, path: startOf(board), phase: "playing" };
}
