import { describe, expect, it } from "vitest";
import {
  advance,
  BALL_RADIUS,
  type BreakoutState,
  brickRect,
  COLS,
  createBreakout,
  LIVES,
  launch,
  movePaddle,
  PADDLE_WIDTH,
  PADDLE_Y,
  ROWS,
} from "./logic.ts";

/** 打ち出した後のボールを好きな位置と速度に置く */
function flying(ball: BreakoutState["ball"], patch: Partial<BreakoutState> = {}): BreakoutState {
  return { ...createBreakout(), attached: false, ball, ...patch };
}

const speedOf = (state: BreakoutState) => Math.hypot(state.ball.vx, state.ball.vy);
const index = (row: number, col: number) => row * COLS + col;

describe("breakout", () => {
  it("AC-G-breakout-1 builds a wall of 8 columns and 5 rows", () => {
    const state = createBreakout();
    expect(state.bricks).toHaveLength(COLS * ROWS);
    expect(state.bricks.every(Boolean)).toBe(true);
    expect(state.lives).toBe(LIVES);
    expect(state.attached).toBe(true);
  });

  it("AC-G-breakout-1 bounces off the walls and the ceiling", () => {
    const s = createBreakout().speed;
    const left = advance(flying({ x: BALL_RADIUS + 0.001, y: 0.7, vx: -s, vy: 0 }), 30);
    expect(left.ball.vx).toBeGreaterThan(0);
    expect(left.ball.x).toBeGreaterThanOrEqual(BALL_RADIUS);
    const right = advance(flying({ x: 1 - BALL_RADIUS - 0.001, y: 0.7, vx: s, vy: 0 }), 30);
    expect(right.ball.vx).toBeLessThan(0);
    expect(right.ball.x).toBeLessThanOrEqual(1 - BALL_RADIUS);
    const bricks = createBreakout().bricks.map(() => false);
    bricks[0] = true;
    const top = advance(flying({ x: 0.9, y: BALL_RADIUS + 0.001, vx: 0, vy: -s }, { bricks }), 30);
    expect(top.ball.vy).toBeGreaterThan(0);
  });

  it("AC-G-breakout-1 bounces off the paddle", () => {
    const s = createBreakout().speed;
    const state = flying({ x: 0.5, y: PADDLE_Y - BALL_RADIUS - 0.002, vx: 0, vy: s });
    const after = advance(state, 30);
    expect(after.ball.vy).toBeLessThan(0);
    expect(after.lives).toBe(LIVES);
  });

  it("AC-G-breakout-2 returns more steeply sideways the farther from the paddle center", () => {
    const s = createBreakout().speed;
    const hit = (offset: number) =>
      advance(
        flying(
          { x: 0.5 + offset, y: PADDLE_Y - BALL_RADIUS - 0.002, vx: 0, vy: s },
          { paddle: 0.5 },
        ),
        30,
      );
    const center = hit(0);
    const right = hit(PADDLE_WIDTH * 0.4);
    const left = hit(-PADDLE_WIDTH * 0.4);
    expect(Math.abs(center.ball.vx)).toBeLessThan(1e-9);
    expect(right.ball.vx).toBeGreaterThan(0);
    expect(left.ball.vx).toBeLessThan(0);
    const edge = hit(PADDLE_WIDTH * 0.5);
    expect(edge.ball.vx).toBeGreaterThan(right.ball.vx);
    for (const state of [center, right, left, edge]) expect(speedOf(state)).toBeCloseTo(s);
  });

  it("AC-G-breakout-3 removes a hit brick, scores it, and bounces back", () => {
    const s = createBreakout().speed;
    const brick = brickRect(index(ROWS - 1, 3));
    const state = flying({
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height + BALL_RADIUS + 0.005,
      vx: 0,
      vy: -s,
    });
    const after = advance(state, 40);
    expect(after.bricks[index(ROWS - 1, 3)]).toBe(false);
    expect(after.bricks.filter(Boolean)).toHaveLength(COLS * ROWS - 1);
    expect(after.score).toBe(1);
    expect(after.ball.vy).toBeGreaterThan(0);
  });

  it("AC-G-breakout-4 loses a ball below the paddle and ends after three", () => {
    const s = createBreakout().speed;
    let state = flying({ x: 0.1, y: 0.99, vx: 0, vy: s }, { paddle: 0.8 });
    state = advance(state, 100);
    expect(state.lives).toBe(LIVES - 1);
    expect(state.attached).toBe(true);
    for (let i = 0; i < LIVES - 1; i++) {
      state = advance({ ...state, attached: false, ball: { x: 0.1, y: 0.99, vx: 0, vy: s } }, 100);
    }
    expect(state.lives).toBe(0);
    expect(state.over).toBe(true);
    expect(advance(state, 100)).toBe(state);
    expect(launch(state)).toBe(state);
  });

  it("AC-G-breakout-5 brings the next wall with a faster ball once the wall is gone", () => {
    const first = createBreakout();
    const bricks = first.bricks.map(() => false);
    const last = index(ROWS - 1, 0);
    bricks[last] = true;
    const brick = brickRect(last);
    const state = flying(
      {
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height + BALL_RADIUS + 0.005,
        vx: 0,
        vy: -first.speed,
      },
      { bricks, score: 39 },
    );
    const after = advance(state, 40);
    expect(after.score).toBe(40);
    expect(after.wall).toBe(2);
    expect(after.bricks.every(Boolean)).toBe(true);
    expect(after.speed).toBeGreaterThan(first.speed);
    expect(after.attached).toBe(true);
  });

  it("AC-G-breakout-6 does not pass through bricks on a long step", () => {
    const s = createBreakout().speed;
    const lowest = brickRect(index(ROWS - 1, 2));
    const state = flying({
      x: lowest.x + lowest.width / 2,
      y: 0.6,
      vx: 0,
      vy: -s,
    });
    const distance = 0.6 - (lowest.y + lowest.height);
    const after = advance(state, ((distance + 0.1) / s) * 1000);
    expect(after.bricks[index(ROWS - 1, 2)]).toBe(false);
    expect(after.bricks[index(ROWS - 2, 2)]).toBe(true);
    expect(after.score).toBe(1);
    expect(after.ball.vy).toBeGreaterThan(0);
  });

  it("keeps the resting ball on the paddle and launches it upward", () => {
    let state = movePaddle(createBreakout(), 0.3);
    expect(state.ball.x).toBeCloseTo(0.3);
    state = advance(state, 100, 1);
    expect(state.paddle).toBeGreaterThan(0.3);
    expect(state.ball.x).toBeCloseTo(state.paddle);
    expect(movePaddle(state, -5).paddle).toBeCloseTo(PADDLE_WIDTH / 2);
    const launched = launch(state);
    expect(launched.attached).toBe(false);
    expect(launched.ball.vy).toBeLessThan(0);
    expect(speedOf(launched)).toBeCloseTo(state.speed);
  });
});
