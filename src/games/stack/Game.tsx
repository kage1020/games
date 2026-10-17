import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useGameKeys, useGameLoop } from "@/sdk/hooks.ts";
import type { GameProps } from "@/sdk/types.ts";
import { advance, type Block, createStack, drop, score } from "./logic.ts";

const WIDTH = 300;
const HEIGHT = 400;
const ROW = 26;
const GAP = 2;
/** 地面から下に空ける高さ */
const GROUND = ROW * 1.5;
/** 動く板を下から何段目より上に出さないか。これを越えたら画面ごと上げる */
const VIEW_ROWS = 10;
const FALL_TIME = 700;
const GRAVITY = 0.0012;
const PERFECT_FLASH = 450;
const OVER_PAUSE = 900;

interface Piece {
  id: number;
  block: Block;
  row: number;
  /** 落ちた距離と速さ（viewBox の単位、ミリ秒あたり） */
  drop: number;
  velocity: number;
  age: number;
}

function rowTop(row: number, camera: number): number {
  return HEIGHT - GROUND - (row + 1) * ROW + camera;
}

function targetCamera(height: number): number {
  return Math.max(0, height - VIEW_ROWS) * ROW;
}

export default function StackGame({ paused, sound, reducedMotion, onHud, onFinish }: GameProps) {
  const [state, setState] = useState(createStack);
  const [camera, setCamera] = useState(0);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [perfectAt, setPerfectAt] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const pieceId = useRef(0);
  const height = score(state);

  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "段", value: String(height) },
      { label: "ぴったり", value: String(state.perfects) },
    ]);
  }, [height, state.perfects]);

  const finish = useEffectEvent(() =>
    onFinish({
      score: score(state),
      stats: [{ label: "ぴったり", value: String(state.perfects), unit: "回" }],
    }),
  );
  useEffect(() => {
    if (!state.over) return;
    const timer = setTimeout(finish, OVER_PAUSE);
    return () => clearTimeout(timer);
  }, [state.over]);

  useGameLoop((dt) => {
    setClock((time) => time + dt);
    setState((current) => advance(current, dt));
    const target = targetCamera(state.blocks.length);
    setCamera((current) =>
      reducedMotion || Math.abs(target - current) < 0.5
        ? target
        : current + (target - current) * Math.min(1, dt / 120),
    );
    setPieces((current) =>
      current.length === 0
        ? current
        : current
            .map((piece) => ({
              ...piece,
              age: piece.age + dt,
              velocity: piece.velocity + GRAVITY * dt,
              drop: piece.drop + piece.velocity * dt,
            }))
            .filter((piece) => piece.age < FALL_TIME),
    );
  }, !paused);

  const handleDrop = () => {
    if (paused || state.over) return;
    const next = drop(state);
    if (next.over) sound.play("over");
    else if (next.perfects > state.perfects) sound.play("good");
    else sound.play("tap");
    if (next.perfects > state.perfects) setPerfectAt(clock);
    if (next.cut && !reducedMotion) {
      const id = pieceId.current++;
      setPieces((current) => [
        ...current,
        {
          id,
          block: next.cut as Block,
          row: state.blocks.length,
          drop: 0,
          velocity: 0,
          age: 0,
        },
      ]);
    }
    setState(next);
  };

  useGameKeys((event) => {
    if (event.key !== " " && event.key !== "Enter") return undefined;
    if (!event.repeat) handleDrop();
    return true;
  }, !paused);

  const movingRow = state.blocks.length;
  const flashing = perfectAt !== null && clock - perfectAt < PERFECT_FLASH;
  const firstRow = Math.max(0, Math.floor(camera / ROW) - 1);
  // 段の高さそのものが識別子。画面より下に沈んだ段は描かない
  const rows = state.blocks
    .map((block, row) => ({ id: `row-${row}`, block, row }))
    .filter(({ row }) => row >= firstRow);
  const label = state.over
    ? `おしまい。${height} 段積んだ`
    : `${height} 段。Space か画面を押してブロックを止める`;

  return (
    <svg
      className="game-svg"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        handleDrop();
      }}
    >
      <rect width={WIDTH} height={HEIGHT} style={{ fill: "var(--bg)" }} />
      <line
        x1={0}
        x2={WIDTH}
        y1={HEIGHT - GROUND + camera}
        y2={HEIGHT - GROUND + camera}
        style={{ stroke: "var(--line)", strokeWidth: 1 }}
        vectorEffect="non-scaling-stroke"
      />
      {rows.map(({ id, block, row }) => (
        <rect
          key={id}
          x={block.x * WIDTH}
          y={rowTop(row, camera) + GAP / 2}
          width={block.width * WIDTH}
          height={ROW - GAP}
          rx={3}
          style={{ fill: row === 0 ? "var(--border)" : "var(--ink)" }}
        />
      ))}
      {rows
        .filter(({ row }) => row > 0 && row % 5 === 0)
        .map(({ id, row }) => (
          <text
            key={`mark-${id}`}
            x={6}
            y={rowTop(row, camera) + ROW / 2}
            dominantBaseline="central"
            style={{ fill: "var(--ink-muted)", font: "500 10px var(--font-mono)" }}
          >
            {row}
          </text>
        ))}
      {flashing && state.blocks.length > 1 ? (
        <>
          <rect
            x={(state.blocks.at(-1)?.x ?? 0) * WIDTH - 3}
            y={rowTop(state.blocks.length - 1, camera) - 2}
            width={(state.blocks.at(-1)?.width ?? 0) * WIDTH + 6}
            height={ROW + 2}
            rx={4}
            style={{ fill: "none", stroke: "var(--focus)", strokeWidth: 2 }}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={WIDTH - 8}
            y={rowTop(state.blocks.length - 1, camera) + ROW / 2}
            textAnchor="end"
            dominantBaseline="central"
            style={{ fill: "var(--ink)", font: "600 12px var(--font-mono)" }}
          >
            ぴったり
          </text>
        </>
      ) : null}
      {pieces.map((piece) => (
        <rect
          key={`piece-${piece.id}`}
          x={piece.block.x * WIDTH}
          y={rowTop(piece.row, camera) + GAP / 2 + piece.drop}
          width={piece.block.width * WIDTH}
          height={ROW - GAP}
          rx={3}
          style={{
            fill: state.over && piece.row === movingRow ? "var(--accent)" : "var(--ink)",
            opacity: 1 - piece.age / FALL_TIME,
          }}
        />
      ))}
      {state.over && reducedMotion && state.cut ? (
        <rect
          x={state.cut.x * WIDTH}
          y={rowTop(movingRow, camera) + GAP / 2}
          width={state.cut.width * WIDTH}
          height={ROW - GAP}
          rx={3}
          style={{ fill: "none", stroke: "var(--accent)", strokeWidth: 2, strokeDasharray: "6 4" }}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {state.over ? null : (
        <rect
          x={state.moving.x * WIDTH}
          y={rowTop(movingRow, camera) + GAP / 2}
          width={state.moving.width * WIDTH}
          height={ROW - GAP}
          rx={3}
          style={{ fill: "var(--accent)" }}
        />
      )}
    </svg>
  );
}
