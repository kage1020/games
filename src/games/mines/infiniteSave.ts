import { type FrontierState, resumeFrontier } from "./frontier.ts";
import { adjacentMines, type Cell, cellKey, type InfiniteState } from "./infinite.ts";
import { clampSpan } from "./infiniteView.ts";

/** 遊んでいる途中の盤面と、映している範囲 */
export interface InfiniteProgress<S = InfiniteState> {
  game: S;
  /** 画面の真ん中に映す盤面の位置 */
  center: Cell;
  /** 短いほうの辺に並べるマスの数 */
  span: number;
  cursor: Cell;
}

/** 地雷の置き方を変えたら上げる。違う版の保存は同じ盤面に戻せないので読み戻さない */
const VERSION = 2;

type Pair = [number, number];

/** 保存する形。開いたマスと旗は [x, y, x, y, …] で持ち、開いたマスの数字はシードから求め直す */
export interface InfiniteSave {
  version: typeof VERSION;
  seed: number;
  start: Pair;
  revealed: number[];
  flagged: number[];
  elapsed: number;
  center: Pair;
  span: number;
  cursor: Pair;
}

/** 開拓の保存する形。踏んだ地雷を加え、区画は開いたマスと踏んだ地雷から求め直す */
export interface FrontierSave extends InfiniteSave {
  hits: number[];
}

function flatten(keys: Iterable<string>): number[] {
  const cells: number[] = [];
  for (const key of keys) {
    const [x, y] = key.split(",");
    cells.push(Number(x), Number(y));
  }
  return cells;
}

function pairs(cells: number[]): Pair[] {
  const result: Pair[] = [];
  for (let i = 0; i < cells.length; i += 2) result.push([cells[i] ?? 0, cells[i + 1] ?? 0]);
  return result;
}

/** 無限と開拓で同じ形の盤面 */
type Board = Pick<InfiniteState, "seed" | "start" | "revealed" | "flagged" | "elapsed">;

export function saveProgress({
  game,
  center,
  span,
  cursor,
}: InfiniteProgress<Board>): InfiniteSave {
  if (game.start === null) throw new Error("まだ最初のマスを開いていない盤面は保存できない");
  return {
    version: VERSION,
    seed: game.seed,
    start: [game.start.x, game.start.y],
    revealed: flatten(game.revealed.keys()),
    flagged: flatten(game.flagged),
    elapsed: game.elapsed,
    center: [center.x, center.y],
    span,
    cursor: [cursor.x, cursor.y],
  };
}

export function saveFrontier(progress: InfiniteProgress<FrontierState>): FrontierSave {
  return { ...saveProgress(progress), hits: flatten(progress.game.hits) };
}

const isPair = (value: unknown, check: (n: number) => boolean): value is Pair =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => typeof n === "number" && check(n));

const isCells = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length % 2 === 0 && value.every((n) => Number.isInteger(n));

const toKeys = (cells: number[]) => pairs(cells).map(([x, y]) => cellKey(x, y));

interface Restored {
  save: Record<string, unknown>;
  board: Omit<Board, "start"> & { start: Cell };
  view: Omit<InfiniteProgress, "game">;
}

/** 盤面と映している範囲を読み戻す。読み戻せない値なら null */
function restoreBoard(data: unknown): Restored | null {
  if (data === null || typeof data !== "object") return null;
  const save = data as Record<string, unknown>;
  if (
    save.version !== VERSION ||
    !Number.isInteger(save.seed) ||
    !isPair(save.start, Number.isInteger) ||
    !isCells(save.revealed) ||
    !isCells(save.flagged) ||
    typeof save.elapsed !== "number" ||
    !Number.isFinite(save.elapsed) ||
    save.elapsed < 0 ||
    !isPair(save.center, Number.isFinite) ||
    typeof save.span !== "number" ||
    !Number.isFinite(save.span) ||
    !isPair(save.cursor, Number.isInteger)
  ) {
    return null;
  }
  const seed = save.seed as number;
  const start = { x: save.start[0], y: save.start[1] };
  return {
    save,
    board: {
      seed,
      start,
      revealed: new Map(
        pairs(save.revealed).map(([x, y]) => [cellKey(x, y), adjacentMines({ seed, start }, x, y)]),
      ),
      flagged: new Set(toKeys(save.flagged)),
      elapsed: save.elapsed,
    },
    view: {
      center: { x: save.center[0], y: save.center[1] },
      span: clampSpan(save.span),
      cursor: { x: save.cursor[0], y: save.cursor[1] },
    },
  };
}

/** 保存した形から途中の盤面に戻す。読み戻せない値なら null */
export function restoreProgress(data: unknown): InfiniteProgress | null {
  const restored = restoreBoard(data);
  if (restored === null) return null;
  return {
    game: { ...restored.board, phase: "playing", exploded: null },
    ...restored.view,
  };
}

/** 開拓の保存した形から途中の盤面に戻す。読み戻せない値なら null */
export function restoreFrontier(data: unknown): InfiniteProgress<FrontierState> | null {
  const restored = restoreBoard(data);
  if (restored === null || !isCells(restored.save.hits)) return null;
  return {
    game: resumeFrontier({ ...restored.board, hits: new Set(toKeys(restored.save.hits)) }),
    ...restored.view,
  };
}
