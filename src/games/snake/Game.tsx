import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { DIRECTIONS, type Direction, directionFromKey } from "@/sdk/grid.ts";
import { useGameKeys, useGameLoop, useSwipe } from "@/sdk/hooks.ts";
import { createRng } from "@/sdk/rng.ts";
import type { GameProps } from "@/sdk/types.ts";
import { createSnake, interval, SIZE, type SnakeState, step, turn } from "./logic.ts";

const CELL = 40;
const BOARD = SIZE * CELL;
const INSET = 3;
const OVER_PAUSE = 700;

function describe(state: SnakeState): string {
  if (state.outcome === "crashed") return `ぶつかった。食べた数 ${state.eaten}`;
  if (state.outcome === "filled") return `盤を埋めた。食べた数 ${state.eaten}`;
  return `長さ ${state.body.length}。食べた数 ${state.eaten}`;
}

export default function SnakeGame({ paused, seed, sound, onHud, onFinish }: GameProps) {
  const dotsId = `snake-dots-${useId().replace(/[^\w-]/g, "")}`;
  const [rng] = useState(() => createRng(seed));
  const [state, setState] = useState(() => createSnake(rng));
  const latest = useRef(state);
  const elapsed = useRef(0);
  const svg = useRef<SVGSVGElement>(null);
  const playing = state.outcome === "playing";
  const active = playing && !paused;

  const update = (next: SnakeState) => {
    latest.current = next;
    setState(next);
  };

  useGameLoop((dt) => {
    elapsed.current += dt;
    let next = latest.current;
    while (next.outcome === "playing" && elapsed.current >= interval(next.body.length)) {
      elapsed.current -= interval(next.body.length);
      const before = next;
      next = step(before, rng);
      if (next.outcome === "crashed") sound.play("bad");
      else if (next.outcome === "filled") sound.play("good");
      else if (next.eaten > before.eaten) sound.play("tap");
    }
    if (next !== latest.current) update(next);
  }, active);

  const steer = (direction: Direction) => {
    if (!active) return;
    const next = turn(latest.current, direction);
    if (next !== latest.current) update(next);
  };

  useGameKeys((event) => {
    const direction = directionFromKey(event.key);
    if (!direction) return undefined;
    steer(direction);
    return true;
  }, active);
  useSwipe(svg, steer, active);

  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "長さ", value: String(state.body.length) },
      { label: "食べた数", value: String(state.eaten) },
    ]);
  }, [state.body.length, state.eaten]);

  const finish = useEffectEvent(() =>
    onFinish({
      score: latest.current.eaten,
      stats: [{ label: "長さ", value: String(latest.current.body.length) }],
    }),
  );
  useEffect(() => {
    if (playing) return;
    const timer = setTimeout(finish, OVER_PAUSE);
    return () => clearTimeout(timer);
  }, [playing]);

  const [head, ...rest] = state.body;
  const { dx, dy } = DIRECTIONS[state.direction];

  return (
    <svg
      ref={svg}
      className="game-svg"
      viewBox={`0 0 ${BOARD} ${BOARD}`}
      role="img"
      aria-label={describe(state)}
    >
      <defs>
        <pattern id={dotsId} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <circle cx={CELL / 2} cy={CELL / 2} r={2} style={{ fill: "var(--border)" }} />
        </pattern>
      </defs>
      <rect width={BOARD} height={BOARD} style={{ fill: "var(--bg)" }} />
      <rect width={BOARD} height={BOARD} style={{ fill: `url(#${dotsId})` }} />
      {state.food ? (
        <circle
          cx={state.food.x * CELL + CELL / 2}
          cy={state.food.y * CELL + CELL / 2}
          r={CELL * 0.3}
          style={{ fill: "var(--accent)" }}
        />
      ) : null}
      {rest.map((part) => (
        <rect
          key={`${part.x}-${part.y}`}
          x={part.x * CELL + INSET}
          y={part.y * CELL + INSET}
          width={CELL - INSET * 2}
          height={CELL - INSET * 2}
          rx={8}
          style={{ fill: "var(--ink)" }}
        />
      ))}
      {head ? (
        <g transform={`translate(${head.x * CELL} ${head.y * CELL})`}>
          <rect
            x={INSET}
            y={INSET}
            width={CELL - INSET * 2}
            height={CELL - INSET * 2}
            rx={8}
            style={{
              fill: "var(--primary)",
              stroke: state.outcome === "crashed" ? "var(--danger)" : "none",
              strokeWidth: 2,
              strokeDasharray: "6 4",
            }}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={CELL / 2 + dx * CELL * 0.2}
            cy={CELL / 2 + dy * CELL * 0.2}
            r={4}
            style={{ fill: "var(--on-primary)" }}
          />
        </g>
      ) : null}
    </svg>
  );
}
