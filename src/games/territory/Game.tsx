import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import { type Direction, directionFromKey } from "@/sdk/grid.ts";
import { useGameKeys, useGameLoop, useSwipe } from "@/sdk/hooks.ts";
import { createRng } from "@/sdk/rng.ts";
import type { GameProps } from "@/sdk/types.ts";
import {
  countCells,
  createTerritory,
  playerCount,
  SIZE,
  STEP_MS,
  steer,
  step,
  type TerritoryState,
} from "./logic.ts";

const CELL = 50;
const BOARD = SIZE * CELL;
const ORIGIN = 50;
const LEGEND_X = 950;
const LEGEND_RIGHT = 1550;
const ROW_HEIGHT = 120;
const OVER_PAUSE = 700;

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const NAMES = ["あなた", "CPU", "CPU", "CPU"];

function clock(stepsLeft: number): string {
  const seconds = Math.ceil((stepsLeft * STEP_MS) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** プレイヤーごとの模様。色だけで見分けさせないために、塗りの上に重ねる */
function Patterns({ prefix }: { prefix: string }) {
  const line = { stroke: "var(--bg)", strokeWidth: 3, opacity: 0.5 };
  return (
    <defs>
      <pattern id={`${prefix}-1`} width={16} height={16} patternUnits="userSpaceOnUse">
        <path d="M-4 4 L4 -4 M0 16 L16 0 M12 20 L20 12" style={line} />
      </pattern>
      <pattern id={`${prefix}-2`} width={16} height={16} patternUnits="userSpaceOnUse">
        <circle cx={8} cy={8} r={3} style={{ fill: "var(--bg)", opacity: 0.55 }} />
      </pattern>
      <pattern id={`${prefix}-3`} width={16} height={16} patternUnits="userSpaceOnUse">
        <path d="M0 8 H16 M8 0 V16" style={line} />
      </pattern>
      <pattern id={`${prefix}-dots`} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
        <circle cx={CELL / 2} cy={CELL / 2} r={2.5} style={{ fill: "var(--border)" }} />
      </pattern>
    </defs>
  );
}

function Swatch({
  prefix,
  player,
  x,
  y,
  size,
}: {
  prefix: string;
  player: number;
  x: number;
  y: number;
  size: number;
}) {
  return (
    <>
      <rect x={x} y={y} width={size} height={size} rx={6} style={{ fill: COLORS[player] }} />
      {player > 0 ? (
        <rect
          x={x}
          y={y}
          width={size}
          height={size}
          rx={6}
          style={{ fill: `url(#${prefix}-${player})` }}
        />
      ) : null}
    </>
  );
}

export default function TerritoryGame({ mode, paused, seed, sound, onHud, onFinish }: GameProps) {
  const prefix = `territory-${useId().replace(/[^\w-]/g, "")}`;
  const [rng] = useState(() => createRng(seed));
  const [state, setState] = useState(() => createTerritory(playerCount(mode)));
  const latest = useRef(state);
  const elapsed = useRef(0);
  const svg = useRef<SVGSVGElement>(null);
  const active = !state.over && !paused;

  const update = (next: TerritoryState) => {
    latest.current = next;
    setState(next);
  };

  useGameLoop((dt) => {
    elapsed.current += dt;
    let next = latest.current;
    while (!next.over && elapsed.current >= STEP_MS) {
      elapsed.current -= STEP_MS;
      const before = countCells(next.owners, 0);
      next = step(next, rng);
      // 1 歩で 2 マス以上増えたら、囲んで取った
      if (countCells(next.owners, 0) - before > 1) sound.play("good");
      if (next.over) sound.play("over");
    }
    if (next !== latest.current) update(next);
  }, active);

  const turn = (direction: Direction) => {
    if (!active) return;
    const next = steer(latest.current, direction);
    if (next !== latest.current) update(next);
  };

  useGameKeys((event) => {
    const direction = directionFromKey(event.key);
    if (!direction) return undefined;
    turn(direction);
    return true;
  }, active);
  useSwipe(svg, turn, active);

  const counts = useMemo(
    () => state.players.map((_, index) => countCells(state.owners, index)),
    [state.owners, state.players],
  );
  const mine = counts[0] ?? 0;
  const remaining = clock(state.stepsLeft);

  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "あなた", value: String(mine) },
      { label: "残り", value: remaining },
    ]);
  }, [mine, remaining]);

  const finish = useEffectEvent(() => {
    const finalCounts = latest.current.players.map((_, index) =>
      countCells(latest.current.owners, index),
    );
    const score = finalCounts[0] ?? 0;
    const rank = 1 + finalCounts.filter((count) => count > score).length;
    onFinish({
      score,
      stats: [{ label: "順位", value: String(rank), unit: `位 / ${finalCounts.length}人` }],
    });
  });
  useEffect(() => {
    if (!state.over) return;
    const timer = setTimeout(finish, OVER_PAUSE);
    return () => clearTimeout(timer);
  }, [state.over]);

  return (
    <svg
      ref={svg}
      className="game-svg"
      viewBox="0 0 1600 900"
      role="img"
      aria-label={`陣取り。あなたのマス ${mine}。残り ${remaining}`}
    >
      <Patterns prefix={prefix} />
      <rect width={1600} height={900} style={{ fill: "var(--bg)" }} />
      <g transform={`translate(${ORIGIN} ${ORIGIN})`}>
        <rect width={BOARD} height={BOARD} style={{ fill: `url(#${prefix}-dots)` }} />
        {state.owners.map((owner, cell) => {
          if (owner === null) return null;
          const x = (cell % SIZE) * CELL;
          const y = Math.floor(cell / SIZE) * CELL;
          return (
            <Swatch
              key={`cell-${x}-${y}`}
              prefix={prefix}
              player={owner}
              x={x + 2}
              y={y + 2}
              size={CELL - 4}
            />
          );
        })}
        {state.players.map((player, index) => (
          <g
            key={`head-${player.number}`}
            transform={`translate(${player.x * CELL} ${player.y * CELL})`}
          >
            <circle
              cx={CELL / 2}
              cy={CELL / 2}
              r={CELL * 0.36}
              style={{ fill: "var(--bg)", stroke: "var(--ink)", strokeWidth: 3 }}
            />
            <text
              x={CELL / 2}
              y={CELL / 2 + 1}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: "var(--ink)", font: "600 22px var(--font-mono)" }}
            >
              {index + 1}
            </text>
            {index === 0 ? (
              <rect
                x={-3}
                y={-3}
                width={CELL + 6}
                height={CELL + 6}
                rx={8}
                style={{ fill: "none", stroke: "var(--focus)", strokeWidth: 2 }}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>
        ))}
      </g>
      <text
        x={LEGEND_X}
        y={110}
        style={{ fill: "var(--ink-muted)", font: "400 26px var(--font-sans)" }}
      >
        持っているマス
      </text>
      {state.players.map((player, index) => {
        const y = 150 + index * ROW_HEIGHT;
        return (
          <g key={`legend-${player.number}`}>
            <Swatch prefix={prefix} player={index} x={LEGEND_X} y={y} size={64} />
            <text
              x={LEGEND_X + 92}
              y={y + 32}
              dominantBaseline="central"
              style={{ fill: "var(--ink)", font: "600 30px var(--font-mono)" }}
            >
              {`P${index + 1}`}
            </text>
            <text
              x={LEGEND_X + 160}
              y={y + 32}
              dominantBaseline="central"
              style={{
                fill: "var(--ink)",
                font: `${index === 0 ? 600 : 400} 30px var(--font-sans)`,
              }}
            >
              {NAMES[index]}
            </text>
            <text
              x={LEGEND_RIGHT}
              y={y + 32}
              textAnchor="end"
              dominantBaseline="central"
              style={{ fill: "var(--ink)", font: "600 40px var(--font-mono)" }}
            >
              {counts[index]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
