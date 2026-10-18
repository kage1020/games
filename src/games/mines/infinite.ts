/**
 * 地雷の割合。0 のマスは周り 9 マスに地雷がないときだけなので、割合を下げると 0 のマスが
 * つながって際限なく開き続ける。0.18 なら 0 のマスは 17% ほどで、広がりは小さく止まる
 */
export const DENSITY = 0.18;

export interface Cell {
  x: number;
  y: number;
}

export type InfinitePhase = "ready" | "playing" | "lost";

export interface InfiniteState {
  seed: number;
  /** 最初に開いたマス。このマスと周り 8 マスには地雷を置かない。null はまだ開いていない */
  start: Cell | null;
  /** 開いたマスと、その周りの地雷の数。キーは cellKey */
  revealed: ReadonlyMap<string, number>;
  flagged: ReadonlySet<string>;
  phase: InfinitePhase;
  exploded: Cell | null;
  /** 最初に開いてからの時間（ミリ秒） */
  elapsed: number;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** シードと位置から [0, 1) の値を作る。同じ入力なら同じ値 */
function noise(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

export function isMine(
  state: Pick<InfiniteState, "seed" | "start">,
  x: number,
  y: number,
): boolean {
  const { start } = state;
  if (start === null) return false;
  if (Math.abs(x - start.x) <= 1 && Math.abs(y - start.y) <= 1) return false;
  return noise(state.seed, x, y) < DENSITY;
}

/** 周り 8 マス */
export function neighbors(x: number, y: number): Cell[] {
  const result: Cell[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx !== 0 || dy !== 0) result.push({ x: x + dx, y: y + dy });
    }
  }
  return result;
}

export function adjacentMines(
  state: Pick<InfiniteState, "seed" | "start">,
  x: number,
  y: number,
): number {
  return neighbors(x, y).filter((cell) => isMine(state, cell.x, cell.y)).length;
}

export function createInfinite(seed: number): InfiniteState {
  return {
    seed,
    start: null,
    revealed: new Map(),
    flagged: new Set(),
    phase: "ready",
    exploded: null,
    elapsed: 0,
  };
}

/** 地雷とわかっているマス（旗など）か。開かず、開いた数字のマスを押したときに数える */
export type Known = (key: string) => boolean;

export interface Spread {
  revealed: ReadonlyMap<string, number>;
  /** 開こうとした cells のうちの地雷。cells の順に並ぶ */
  mines: Cell[];
}

/**
 * cells のうち地雷でないマスを開き、0 のマスからはつながる 0 とその縁まで広げる。
 * 開いたマスと known のマスは開かない
 */
export function spread(
  board: Pick<InfiniteState, "seed" | "start" | "revealed">,
  known: Known,
  cells: Cell[],
): Spread {
  const targets = cells.filter(
    (cell) => !board.revealed.has(cellKey(cell.x, cell.y)) && !known(cellKey(cell.x, cell.y)),
  );
  const mines = targets.filter((cell) => isMine(board, cell.x, cell.y));
  const queue = targets.filter((cell) => !isMine(board, cell.x, cell.y));
  if (queue.length === 0) return { revealed: board.revealed, mines };

  const revealed = new Map(board.revealed);
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const key = cellKey(next.x, next.y);
    if (revealed.has(key)) continue;
    const count = adjacentMines(board, next.x, next.y);
    revealed.set(key, count);
    if (count > 0) continue;
    for (const cell of neighbors(next.x, next.y)) {
      const around = cellKey(cell.x, cell.y);
      if (!revealed.has(around) && !known(around)) queue.push(cell);
    }
  }
  return { revealed, mines };
}

/**
 * 開いた数字のマス (x, y) の周りで、地雷とわかっているマスの数が数字と同じなら、残りの閉じた周りを返す。
 * そうでなければ空
 */
export function chordTargets(
  revealed: ReadonlyMap<string, number>,
  known: Known,
  x: number,
  y: number,
): Cell[] {
  const count = revealed.get(cellKey(x, y));
  if (count === undefined || count === 0) return [];
  const around = neighbors(x, y);
  const marks = around.filter((cell) => known(cellKey(cell.x, cell.y))).length;
  if (marks !== count) return [];
  return around.filter((cell) => {
    const key = cellKey(cell.x, cell.y);
    return !revealed.has(key) && !known(key);
  });
}

/**
 * マスを開く。最初の 1 回で、そのマスと周りを地雷のない場所にする。
 * 開いた数字のマスなら、周りの旗が数字と同じときに旗のない周りを開く。開くマスに地雷があれば何も開かずに終わる
 */
export function reveal(state: InfiniteState, x: number, y: number): InfiniteState {
  if (state.phase === "lost") return state;
  const key = cellKey(x, y);
  if (state.flagged.has(key)) return state;
  const current: InfiniteState =
    state.start === null ? { ...state, start: { x, y }, phase: "playing" } : state;
  const flagged: Known = (cell) => current.flagged.has(cell);
  const cells = current.revealed.has(key)
    ? chordTargets(current.revealed, flagged, x, y)
    : [{ x, y }];
  if (cells.length === 0) return state;

  const { revealed, mines } = spread(current, flagged, cells);
  const [mine] = mines;
  if (mine) return { ...current, phase: "lost", exploded: mine };
  return { ...current, revealed };
}

/** 旗を立て外しできるマス */
export function canToggleFlag(state: InfiniteState, x: number, y: number): boolean {
  return state.phase !== "lost" && !state.revealed.has(cellKey(x, y));
}

export function toggleFlag(state: InfiniteState, x: number, y: number): InfiniteState {
  if (!canToggleFlag(state, x, y)) return state;
  const key = cellKey(x, y);
  const flagged = new Set(state.flagged);
  if (!flagged.delete(key)) flagged.add(key);
  return { ...state, flagged };
}

export function tick(state: InfiniteState, dt: number): InfiniteState {
  return state.phase === "playing" ? { ...state, elapsed: state.elapsed + dt } : state;
}
