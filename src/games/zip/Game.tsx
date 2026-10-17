import { type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { formatDuration } from "@/platform/format.ts";
import { directionFromKey } from "@/sdk/grid.ts";
import { svgPoint, useGameKeys, useGameLoop } from "@/sdk/hooks.ts";
import { createRng } from "@/sdk/rng.ts";
import type { GameProps } from "@/sdk/types.ts";
import {
  BOARD_COUNT,
  createZip,
  moveTo,
  nextBoard,
  nextCheckpoint,
  step,
  tick,
  undo,
  type ZipState,
} from "./logic.ts";

const CELL = 100;
const MARGIN = 10;
const CLEARED_PAUSE = 600;
const DONE_PAUSE = 700;

function describe(state: ZipState): string {
  const { size } = state.board;
  if (state.phase === "cleared") return `${state.stage + 1} 面をクリアした`;
  if (state.phase === "done") return "5 面をすべてクリアした";
  const rest = size * size - state.path.length;
  return `${state.stage + 1} 面目。次は ${nextCheckpoint(state.board, state.path)}。残り ${rest} マス`;
}

const center = (cell: number, size: number) => ({
  x: (cell % size) * CELL + CELL / 2,
  y: Math.floor(cell / size) * CELL + CELL / 2,
});

export default function ZipGame({ seed, paused, sound, onHud, onFinish }: GameProps) {
  const [rng] = useState(() => createRng(seed));
  const [state, setState] = useState(() => createZip(rng));
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const { size } = state.board;

  useGameLoop(
    (dt) => setState((current) => tick(current, dt)),
    !paused && state.phase === "playing",
  );

  const stageText = `${state.stage + 1} / ${BOARD_COUNT}`;
  const timeText = formatDuration(state.elapsed);
  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "面", value: stageText },
      { label: "時間", value: timeText },
    ]);
  }, [stageText, timeText]);

  const playSound = useEffectEvent((phase: ZipState["phase"]) => {
    if (phase === "cleared") sound.play("good");
    if (phase === "done") sound.play("clear");
  });
  useEffect(() => {
    playSound(state.phase);
  }, [state.phase]);

  const finish = useEffectEvent(() => onFinish({ score: Math.round(state.elapsed) }));
  useEffect(() => {
    if (paused) return;
    if (state.phase === "cleared") {
      const timer = setTimeout(() => setState((current) => nextBoard(current, rng)), CLEARED_PAUSE);
      return () => clearTimeout(timer);
    }
    if (state.phase === "done") {
      const timer = setTimeout(finish, DONE_PAUSE);
      return () => clearTimeout(timer);
    }
  }, [state.phase, paused, rng]);

  useGameKeys((event) => {
    const direction = directionFromKey(event.key);
    if (direction) {
      setState((current) => step(current, direction));
      return true;
    }
    if (event.key === "Backspace") {
      setState(undo);
      return true;
    }
    return undefined;
  }, !paused);

  const cellAt = (event: PointerEvent<SVGSVGElement>): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svgPoint(svg, event.clientX, event.clientY);
    const x = Math.floor(point.x / CELL);
    const y = Math.floor(point.y / CELL);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return y * size + x;
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (paused || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = event.pointerId;
    const cell = cellAt(event);
    if (cell !== null) setState((current) => moveTo(current, cell));
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (paused || dragging.current !== event.pointerId) return;
    const cell = cellAt(event);
    if (cell !== null) setState((current) => moveTo(current, cell));
  };

  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current === event.pointerId) dragging.current = null;
  };

  const points = state.path
    .map((cell) => {
      const { x, y } = center(cell, size);
      return `${x},${y}`;
    })
    .join(" ");
  const head = state.path.at(-1);
  const headPoint = head === undefined ? null : center(head, size);
  const extent = size * CELL;

  return (
    <svg
      ref={svgRef}
      className="game-svg"
      viewBox={`${-MARGIN} ${-MARGIN} ${extent + MARGIN * 2} ${extent + MARGIN * 2}`}
      role="img"
      aria-label={describe(state)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <rect
        x={-MARGIN}
        y={-MARGIN}
        width={extent + MARGIN * 2}
        height={extent + MARGIN * 2}
        style={{ fill: "var(--bg)" }}
      />
      {state.board.checkpoints.map((_, cell) => {
        const { x, y } = center(cell, size);
        return (
          <g key={`cell-${x}-${y}`}>
            <rect
              x={x - CELL / 2 + 4}
              y={y - CELL / 2 + 4}
              width={CELL - 8}
              height={CELL - 8}
              rx={8}
              style={{ fill: "var(--bg-subtle)" }}
            />
            <circle cx={x} cy={y} r={3} style={{ fill: "var(--border)" }} />
          </g>
        );
      })}
      {state.path.length > 1 ? (
        <polyline
          points={points}
          style={{
            fill: "none",
            stroke: "var(--accent)",
            strokeWidth: 40,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        />
      ) : null}
      {state.board.checkpoints.map((number, cell) => {
        if (number === null) return null;
        const { x, y } = center(cell, size);
        return (
          <g key={`checkpoint-${number}`}>
            <circle cx={x} cy={y} r={30} style={{ fill: "var(--primary)" }} />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: "var(--on-primary)", font: "600 32px var(--font-mono)" }}
            >
              {number}
            </text>
          </g>
        );
      })}
      {headPoint && state.phase === "playing" ? (
        <rect
          x={headPoint.x - CELL / 2 + 2}
          y={headPoint.y - CELL / 2 + 2}
          width={CELL - 4}
          height={CELL - 4}
          rx={10}
          style={{ fill: "none", stroke: "var(--focus)", strokeWidth: 2 }}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
