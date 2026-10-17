/** 盤の幅と高さを 1 とした座標。y は下向き */

export const COLS = 8;
export const ROWS = 5;
export const LIVES = 3;

const SIDE = 0.04;
const BRICK_TOP = 0.12;
const BRICK_GAP = 0.01;
const BRICK_HEIGHT = 0.045;
const BRICK_WIDTH = (1 - SIDE * 2 - BRICK_GAP * (COLS - 1)) / COLS;

export const PADDLE_Y = 0.9;
export const PADDLE_HEIGHT = 0.025;
export const PADDLE_WIDTH = 0.2;
/** 1 秒に動く盤の幅 */
export const PADDLE_SPEED = 1.3;
export const BALL_RADIUS = 0.015;

const START_SPEED = 0.55;
const SPEED_UP = 1.1;
const MAX_ANGLE = (60 * Math.PI) / 180;
const LAUNCH_ANGLE = (20 * Math.PI) / 180;

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BreakoutState {
  /** 上の段から左から順。true は残っているブロック */
  bricks: boolean[];
  /** パドルの中心 */
  paddle: number;
  ball: Ball;
  /** ボールがパドルの上で打ち出しを待っている */
  attached: boolean;
  lives: number;
  score: number;
  /** 何面目か */
  wall: number;
  /** 1 秒に進む盤の幅 */
  speed: number;
  over: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function brickRect(index: number): Rect {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return {
    x: SIDE + col * (BRICK_WIDTH + BRICK_GAP),
    y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
    width: BRICK_WIDTH,
    height: BRICK_HEIGHT,
  };
}

function fullWall(): boolean[] {
  return Array.from({ length: COLS * ROWS }, () => true);
}

function clampPaddle(x: number): number {
  return Math.min(1 - PADDLE_WIDTH / 2, Math.max(PADDLE_WIDTH / 2, x));
}

function resting(paddle: number): Ball {
  return { x: paddle, y: PADDLE_Y - BALL_RADIUS - 0.001, vx: 0, vy: 0 };
}

export function createBreakout(): BreakoutState {
  return {
    bricks: fullWall(),
    paddle: 0.5,
    ball: resting(0.5),
    attached: true,
    lives: LIVES,
    score: 0,
    wall: 1,
    speed: START_SPEED,
    over: false,
  };
}

export function movePaddle(state: BreakoutState, x: number): BreakoutState {
  if (state.over) return state;
  const paddle = clampPaddle(x);
  return { ...state, paddle, ball: state.attached ? resting(paddle) : state.ball };
}

export function launch(state: BreakoutState): BreakoutState {
  if (state.over || !state.attached) return state;
  return {
    ...state,
    attached: false,
    ball: {
      ...resting(state.paddle),
      vx: state.speed * Math.sin(LAUNCH_ANGLE),
      vy: -state.speed * Math.cos(LAUNCH_ANGLE),
    },
  };
}

function hitsPaddle(ball: Ball, paddle: number): boolean {
  return (
    ball.vy > 0 &&
    ball.y + BALL_RADIUS >= PADDLE_Y &&
    ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT &&
    Math.abs(ball.x - paddle) <= PADDLE_WIDTH / 2 + BALL_RADIUS
  );
}

/** ボールとブロックが触れていれば、跳ね返したボールを返す */
function bounceOffBrick(ball: Ball, brick: Rect): Ball | null {
  const nearX = Math.min(Math.max(ball.x, brick.x), brick.x + brick.width);
  const nearY = Math.min(Math.max(ball.y, brick.y), brick.y + brick.height);
  if ((ball.x - nearX) ** 2 + (ball.y - nearY) ** 2 > BALL_RADIUS ** 2) return null;
  const fromSide =
    (ball.x < brick.x || ball.x > brick.x + brick.width) &&
    ball.y >= brick.y &&
    ball.y <= brick.y + brick.height;
  if (fromSide) {
    const vx = -ball.vx;
    return {
      ...ball,
      vx,
      x: vx < 0 ? brick.x - BALL_RADIUS : brick.x + brick.width + BALL_RADIUS,
    };
  }
  const vy = -ball.vy;
  return {
    ...ball,
    vy,
    y: vy > 0 ? brick.y + brick.height + BALL_RADIUS : brick.y - BALL_RADIUS,
  };
}

/**
 * dt ミリ秒ぶん進める。steer（-1〜1）でパドルを動かす。
 * ボールは半径の半分より小さい刻みで動かし、ブロックをすり抜けない。
 */
export function advance(state: BreakoutState, dt: number, steer = 0): BreakoutState {
  if (state.over) return state;
  const paddle = clampPaddle(state.paddle + steer * PADDLE_SPEED * (dt / 1000));
  if (state.attached) return { ...state, paddle, ball: resting(paddle) };

  let ball = state.ball;
  let bricks = state.bricks;
  let score = state.score;
  const steps = Math.max(1, Math.ceil((state.speed * (dt / 1000)) / (BALL_RADIUS / 2)));
  const step = dt / 1000 / steps;

  for (let i = 0; i < steps; i++) {
    ball = { ...ball, x: ball.x + ball.vx * step, y: ball.y + ball.vy * step };

    if (ball.x - BALL_RADIUS < 0) ball = { ...ball, x: BALL_RADIUS, vx: Math.abs(ball.vx) };
    if (ball.x + BALL_RADIUS > 1) ball = { ...ball, x: 1 - BALL_RADIUS, vx: -Math.abs(ball.vx) };
    if (ball.y - BALL_RADIUS < 0) ball = { ...ball, y: BALL_RADIUS, vy: Math.abs(ball.vy) };

    if (hitsPaddle(ball, paddle)) {
      const offset = Math.min(1, Math.max(-1, (ball.x - paddle) / (PADDLE_WIDTH / 2)));
      const angle = offset * MAX_ANGLE;
      ball = {
        x: ball.x,
        y: PADDLE_Y - BALL_RADIUS,
        vx: state.speed * Math.sin(angle),
        vy: -state.speed * Math.cos(angle),
      };
    }

    for (let b = 0; b < bricks.length; b++) {
      if (!bricks[b]) continue;
      const bounced = bounceOffBrick(ball, brickRect(b));
      if (!bounced) continue;
      ball = bounced;
      bricks = bricks.map((alive, j) => alive && j !== b);
      score += 1;
      break;
    }

    if (!bricks.some(Boolean)) {
      return {
        ...state,
        paddle,
        bricks: fullWall(),
        ball: resting(paddle),
        attached: true,
        score,
        wall: state.wall + 1,
        speed: state.speed * SPEED_UP,
      };
    }

    if (ball.y - BALL_RADIUS > 1) {
      const lives = state.lives - 1;
      return {
        ...state,
        paddle,
        bricks,
        score,
        lives,
        over: lives <= 0,
        attached: true,
        ball: resting(paddle),
      };
    }
  }

  return { ...state, paddle, ball, bricks, score };
}
