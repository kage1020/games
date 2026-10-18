import { type Cell, cellKey, chordTargets, isMine, type Known, spread } from "./infinite.ts";

/** 区画の一辺のマスの数 */
export const SECTOR = 8;

export type FrontierPhase = "ready" | "playing" | "ended";

/** 開拓の盤面。マスの置き方と開き方は無限と同じで、地雷を踏んでも終わらない */
export interface FrontierState {
  seed: number;
  /** 最初に開いたマス。このマスと周り 8 マスには地雷を置かない。null はまだ開いていない */
  start: Cell | null;
  /** 開いたマスと、その周りの地雷の数。キーは cellKey */
  revealed: ReadonlyMap<string, number>;
  flagged: ReadonlySet<string>;
  /** 踏んだ地雷。開けず旗も立てられないが、旗と同じく地雷とわかっているマスとして数える */
  hits: ReadonlySet<string>;
  /** 地雷でないマスをすべて開いた区画。キーは sectorAt */
  secured: ReadonlySet<string>;
  /** 踏んだ地雷があり、もう確保できない区画 */
  lost: ReadonlySet<string>;
  phase: FrontierPhase;
  /** 最初に開いてからの時間（ミリ秒） */
  elapsed: number;
}

function cellOf(key: string): Cell {
  const [x = 0, y = 0] = key.split(",").map(Number);
  return { x, y };
}

/** マス (x, y) を含む区画のキー */
export function sectorAt(x: number, y: number): string {
  return cellKey(Math.floor(x / SECTOR), Math.floor(y / SECTOR));
}

function sectorOf(key: string): string {
  const { x, y } = cellOf(key);
  return sectorAt(x, y);
}

function sectorCells(sector: string): Cell[] {
  const { x: sx, y: sy } = cellOf(sector);
  const cells: Cell[] = [];
  for (let y = sy * SECTOR; y < (sy + 1) * SECTOR; y++) {
    for (let x = sx * SECTOR; x < (sx + 1) * SECTOR; x++) cells.push({ x, y });
  }
  return cells;
}

export function createFrontier(seed: number): FrontierState {
  return {
    seed,
    start: null,
    revealed: new Map(),
    flagged: new Set(),
    hits: new Set(),
    secured: new Set(),
    lost: new Set(),
    phase: "ready",
    elapsed: 0,
  };
}

const knownMines =
  (state: Pick<FrontierState, "flagged" | "hits">): Known =>
  (key) =>
    state.flagged.has(key) || state.hits.has(key);

/** sectors のうち、確保できなくなっておらず地雷でないマスがすべて開いた区画を確保し、残った地雷に旗を立てる */
function secure(state: FrontierState, sectors: Iterable<string>): FrontierState {
  const secured = new Set(state.secured);
  const flagged = new Set(state.flagged);
  for (const sector of sectors) {
    if (secured.has(sector) || state.lost.has(sector)) continue;
    const cells = sectorCells(sector);
    const cleared = cells.every(
      (cell) => isMine(state, cell.x, cell.y) || state.revealed.has(cellKey(cell.x, cell.y)),
    );
    if (!cleared) continue;
    secured.add(sector);
    for (const cell of cells) {
      if (isMine(state, cell.x, cell.y)) flagged.add(cellKey(cell.x, cell.y));
    }
  }
  return secured.size === state.secured.size ? state : { ...state, secured, flagged };
}

/**
 * マスを開く。最初の 1 回で、そのマスと周りを地雷のない場所にする。開いた数字のマスなら、周りの旗と踏んだ地雷が
 * 数字と同じときに残りの周りを開く。開いた地雷はすべて踏んだ地雷になり、地雷でないマスはそのまま開く
 */
export function reveal(state: FrontierState, x: number, y: number): FrontierState {
  if (state.phase === "ended") return state;
  const key = cellKey(x, y);
  if (state.flagged.has(key) || state.hits.has(key)) return state;
  const current: FrontierState =
    state.start === null ? { ...state, start: { x, y }, phase: "playing" } : state;
  const known = knownMines(current);
  const cells = current.revealed.has(key)
    ? chordTargets(current.revealed, known, x, y)
    : [{ x, y }];
  if (cells.length === 0) return state;

  const { revealed, mines } = spread(current, known, cells);
  const hits = new Set(current.hits);
  const lost = new Set(current.lost);
  for (const mine of mines) {
    hits.add(cellKey(mine.x, mine.y));
    lost.add(sectorAt(mine.x, mine.y));
  }
  const touched = new Set<string>();
  for (const opened of revealed.keys()) {
    if (!current.revealed.has(opened)) touched.add(sectorOf(opened));
  }
  return secure({ ...current, revealed, hits, lost }, touched);
}

/** 旗を立て外しできるマス。開いたマス・踏んだ地雷・確保した区画のマスはできない */
export function canToggleFlag(state: FrontierState, x: number, y: number): boolean {
  const key = cellKey(x, y);
  return (
    state.phase !== "ended" &&
    !state.revealed.has(key) &&
    !state.hits.has(key) &&
    !state.secured.has(sectorAt(x, y))
  );
}

export function toggleFlag(state: FrontierState, x: number, y: number): FrontierState {
  if (!canToggleFlag(state, x, y)) return state;
  const key = cellKey(x, y);
  const flagged = new Set(state.flagged);
  if (!flagged.delete(key)) flagged.add(key);
  return { ...state, flagged };
}

export function tick(state: FrontierState, dt: number): FrontierState {
  return state.phase === "playing" ? { ...state, elapsed: state.elapsed + dt } : state;
}

/** 遊んでいる盤面を終える。まだ最初のマスを開いていなければ何もしない */
export function endFrontier(state: FrontierState): FrontierState {
  return state.phase === "playing" ? { ...state, phase: "ended" } : state;
}

/** 最初のマスを開いたあとの盤面に戻す。区画は開いたマスと踏んだ地雷から求め直す */
export function resumeFrontier(
  board: Pick<FrontierState, "seed" | "revealed" | "flagged" | "hits" | "elapsed"> & {
    start: Cell;
  },
): FrontierState {
  return secure(
    {
      ...board,
      secured: new Set(),
      lost: new Set([...board.hits].map(sectorOf)),
      phase: "playing",
    },
    new Set([...board.revealed.keys()].map(sectorOf)),
  );
}
