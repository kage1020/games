import { DIRECTIONS, type Direction, OPPOSITE } from "@/sdk/grid.ts";
import type { Rng } from "@/sdk/rng.ts";

export const SIZE = 20;
export const START_LENGTH = 3;
export const MAX_QUEUE = 2;
export const START_INTERVAL = 140;
export const MIN_INTERVAL = 70;
const SPEED_UP = 2;

export interface Point {
  x: number;
  y: number;
}

export type Outcome = "playing" | "crashed" | "filled";

export interface SnakeState {
  /** 頭が先頭 */
  body: Point[];
  direction: Direction;
  /** 先行入力した方向転換 */
  queue: Direction[];
  food: Point | null;
  eaten: number;
  outcome: Outcome;
}

const key = (p: Point) => p.y * SIZE + p.x;

function placeFood(body: Point[], rng: Rng): Point | null {
  const taken = new Set(body.map(key));
  const empty: Point[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) if (!taken.has(y * SIZE + x)) empty.push({ x, y });
  }
  return empty.length === 0 ? null : rng.pick(empty);
}

export function createSnake(rng: Rng): SnakeState {
  const center = SIZE / 2;
  const body = Array.from({ length: START_LENGTH }, (_, i) => ({ x: center - i, y: center }));
  return {
    body,
    direction: "right",
    queue: [],
    food: placeFood(body, rng),
    eaten: 0,
    outcome: "playing",
  };
}

/** 1 マス進む間隔。長くなるほど短く、下限がある */
export function interval(length: number): number {
  return Math.max(MIN_INTERVAL, START_INTERVAL - (length - START_LENGTH) * SPEED_UP);
}

/** 方向転換を先行入力として積む。真後ろへの方向転換は無視する */
export function turn(state: SnakeState, direction: Direction): SnakeState {
  if (state.outcome !== "playing" || state.queue.length >= MAX_QUEUE) return state;
  const last = state.queue.at(-1) ?? state.direction;
  if (direction === last || direction === OPPOSITE[last]) return state;
  return { ...state, queue: [...state.queue, direction] };
}

export function step(state: SnakeState, rng: Rng): SnakeState {
  if (state.outcome !== "playing") return state;
  const [direction = state.direction, ...queue] = state.queue;
  const head = state.body[0];
  if (!head) return state;
  const { dx, dy } = DIRECTIONS[direction];
  const next = { x: head.x + dx, y: head.y + dy };
  if (next.x < 0 || next.y < 0 || next.x >= SIZE || next.y >= SIZE) {
    return { ...state, direction, queue, outcome: "crashed" };
  }
  const eating = state.food !== null && key(state.food) === key(next);
  // エサを食べないステップでは尾が同時に空くので、尾のマスには入れる
  const blocking = eating ? state.body : state.body.slice(0, -1);
  if (blocking.some((part) => key(part) === key(next))) {
    return { ...state, direction, queue, outcome: "crashed" };
  }
  const body = [next, ...blocking];
  if (!eating) return { ...state, body, direction, queue };
  const food = placeFood(body, rng);
  return {
    body,
    direction,
    queue,
    food,
    eaten: state.eaten + 1,
    outcome: food === null ? "filled" : "playing",
  };
}
