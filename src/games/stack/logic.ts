/** 盤の幅を 1 とした座標。x はブロックの左端 */
export interface Block {
  x: number;
  width: number;
}

export const BASE_WIDTH = 0.6;
/** これ以下のずれは「ぴったり」として下の段に揃える（盤の幅に対する割合） */
export const PERFECT_TOLERANCE = 0.03;

const BASE_SPEED = 0.45;
const SPEED_STEP = 0.035;
const MAX_SPEED = 1.6;

export interface StackState {
  /** blocks[0] は土台 */
  blocks: Block[];
  moving: Block;
  direction: 1 | -1;
  /** 1 秒に動く盤の幅 */
  speed: number;
  perfects: number;
  /** 直前に切り落とされた部分（終わったときは落としたブロックそのもの） */
  cut: Block | null;
  over: boolean;
}

export function speedFor(height: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + height * SPEED_STEP);
}

/** 段が増えるたびに左右の端を入れ替えて出す */
function nextMoving(width: number, height: number): Pick<StackState, "moving" | "direction"> {
  return height % 2 === 1
    ? { moving: { x: 0, width }, direction: 1 }
    : { moving: { x: 1 - width, width }, direction: -1 };
}

export function createStack(): StackState {
  const base: Block = { x: (1 - BASE_WIDTH) / 2, width: BASE_WIDTH };
  return {
    blocks: [base],
    ...nextMoving(BASE_WIDTH, 1),
    speed: speedFor(0),
    perfects: 0,
    cut: null,
    over: false,
  };
}

export function score(state: StackState): number {
  return state.blocks.length - 1;
}

/** ブロックを dt ミリ秒ぶん動かす。端では折り返す */
export function advance(state: StackState, dt: number): StackState {
  if (state.over) return state;
  const range = 1 - state.moving.width;
  let x = state.moving.x + state.direction * state.speed * (dt / 1000);
  let direction = state.direction;
  // 一度に大きく進んでも盤の中に戻るまで折り返す
  while (x < 0 || x > range) {
    if (x < 0) {
      x = -x;
      direction = 1;
    } else {
      x = 2 * range - x;
      direction = -1;
    }
  }
  return { ...state, moving: { ...state.moving, x }, direction };
}

/** ブロックを落とす。重なった部分だけ残し、重ならなければ終わる */
export function drop(state: StackState): StackState {
  if (state.over) return state;
  const top = state.blocks.at(-1);
  if (!top) return state;
  const { moving } = state;

  if (Math.abs(moving.x - top.x) <= PERFECT_TOLERANCE + 1e-9) {
    const blocks = [...state.blocks, { ...top }];
    return {
      ...state,
      blocks,
      ...nextMoving(top.width, blocks.length),
      speed: speedFor(blocks.length - 1),
      perfects: state.perfects + 1,
      cut: null,
    };
  }

  const left = Math.max(moving.x, top.x);
  const right = Math.min(moving.x + moving.width, top.x + top.width);
  if (right - left <= 0) return { ...state, cut: { ...moving }, over: true };

  const placed: Block = { x: left, width: right - left };
  const cut: Block =
    moving.x < top.x
      ? { x: moving.x, width: left - moving.x }
      : { x: right, width: moving.x + moving.width - right };
  const blocks = [...state.blocks, placed];
  return {
    ...state,
    blocks,
    ...nextMoving(placed.width, blocks.length),
    speed: speedFor(blocks.length - 1),
    cut,
  };
}
