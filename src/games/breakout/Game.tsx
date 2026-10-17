import { type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { directionFromKey } from "@/sdk/grid.ts";
import { svgPoint, useGameKeys, useGameLoop } from "@/sdk/hooks.ts";
import type { GameProps } from "@/sdk/types.ts";
import {
  advance,
  BALL_RADIUS,
  brickRect,
  createBreakout,
  launch,
  movePaddle,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_Y,
} from "./logic.ts";

const SIZE = 1000;
const OVER_PAUSE = 800;

/** ブロックの位置は盤の上で決まっているので、位置そのものを識別子にする */
const BRICKS = Array.from({ length: 40 }, (_, index) => {
  const rect = brickRect(index);
  return { index, id: `brick-${rect.x.toFixed(3)}-${rect.y.toFixed(3)}`, rect };
});

export default function BreakoutGame({ paused, sound, onHud, onFinish }: GameProps) {
  const [state, setState] = useState(createBreakout);
  const held = useRef({ left: false, right: false });
  const previous = useRef({ score: 0, lives: state.lives, wall: 1 });

  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "崩した", value: String(state.score) },
      { label: "残り", value: String(state.lives) },
    ]);
  }, [state.score, state.lives]);

  const playSounds = useEffectEvent(
    (now: { score: number; lives: number; wall: number; over: boolean }) => {
      const before = previous.current;
      if (now.over) sound.play("over");
      else if (now.wall > before.wall) sound.play("clear");
      else if (now.lives < before.lives) sound.play("bad");
      else if (now.score > before.score) sound.play("tap");
      previous.current = { score: now.score, lives: now.lives, wall: now.wall };
    },
  );
  useEffect(() => {
    playSounds({ score: state.score, lives: state.lives, wall: state.wall, over: state.over });
  }, [state.score, state.lives, state.wall, state.over]);

  const finish = useEffectEvent(() =>
    onFinish({
      score: state.score,
      stats: [{ label: "面", value: String(state.wall) }],
    }),
  );
  useEffect(() => {
    if (!state.over) return;
    const timer = setTimeout(finish, OVER_PAUSE);
    return () => clearTimeout(timer);
  }, [state.over]);

  useEffect(() => {
    const release = (event: KeyboardEvent) => {
      const direction = directionFromKey(event.key);
      if (direction === "left") held.current.left = false;
      if (direction === "right") held.current.right = false;
    };
    const releaseAll = () => {
      held.current = { left: false, right: false };
    };
    window.addEventListener("keyup", release);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", releaseAll);
    };
  }, []);

  useGameLoop((dt) => {
    const steer = Number(held.current.right) - Number(held.current.left);
    setState((current) => advance(current, dt, steer));
  }, !paused && !state.over);

  useGameKeys((event) => {
    const direction = directionFromKey(event.key);
    if (direction === "left" || direction === "right") {
      held.current[direction] = true;
      return true;
    }
    if (event.key === " " || event.key === "Enter") {
      if (!event.repeat) setState((current) => launch(current));
      return true;
    }
    return undefined;
  }, !paused);

  const follow = (event: PointerEvent<SVGSVGElement>) => {
    if (paused) return;
    const { x } = svgPoint(event.currentTarget, event.clientX, event.clientY);
    setState((current) => movePaddle(current, x / SIZE));
  };

  const label = state.over
    ? `おしまい。${state.score} 個崩した`
    : `${state.score} 個崩した。残り ${state.lives}`;

  return (
    <svg
      className="game-svg"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        if (paused) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        follow(event);
        setState((current) => launch(current));
      }}
      onPointerMove={follow}
    >
      <rect width={SIZE} height={SIZE} style={{ fill: "var(--bg)" }} />
      {BRICKS.map(({ index, id, rect }) =>
        state.bricks[index] ? (
          <rect
            key={id}
            x={rect.x * SIZE}
            y={rect.y * SIZE}
            width={rect.width * SIZE}
            height={rect.height * SIZE}
            rx={4}
            style={{ fill: "var(--ink)" }}
          />
        ) : null,
      )}
      <rect
        x={(state.paddle - PADDLE_WIDTH / 2) * SIZE}
        y={PADDLE_Y * SIZE}
        width={PADDLE_WIDTH * SIZE}
        height={PADDLE_HEIGHT * SIZE}
        rx={6}
        style={{ fill: "var(--primary)" }}
      />
      <circle
        cx={state.ball.x * SIZE}
        cy={state.ball.y * SIZE}
        r={BALL_RADIUS * SIZE}
        style={{ fill: "var(--accent)" }}
      />
      {state.attached && !state.over ? (
        <text
          x={SIZE / 2}
          y={PADDLE_Y * SIZE - 80}
          textAnchor="middle"
          style={{ fill: "var(--ink-muted)", font: "400 28px var(--font-sans)" }}
        >
          Space か画面を押して打ち出す
        </text>
      ) : null}
    </svg>
  );
}
