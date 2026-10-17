import { useEffect, useEffectEvent, useState } from "react";
import { DIRECTIONS, directionFromKey } from "@/sdk/grid.ts";
import { useGameKeys } from "@/sdk/hooks.ts";
import { createRng } from "@/sdk/rng.ts";
import type { GameProps } from "@/sdk/types.ts";
import { advance, COLS, createMemory, MAX_MISSES, type MemoryState, press, ROWS } from "./logic.ts";

const CELL = 100;
const INSET = 8;
const CLEARED_PAUSE = 500;
const MISSED_PAUSE = 1100;
const OVER_PAUSE = 900;

function describe(state: MemoryState): string {
  switch (state.phase) {
    case "show":
      return `${state.level} 個の数の位置を覚えて、1 を押す`;
    case "hidden":
      return `${state.next} を押す`;
    case "cleared":
      return `${state.level} 個を覚えた`;
    case "missed":
      return `ちがう。残り ${MAX_MISSES - state.misses} 回`;
    case "over":
      return "おしまい";
  }
}

export default function MemoryGame({ seed, sound, onHud, onFinish }: GameProps) {
  const [rng] = useState(() => createRng(seed));
  const [state, setState] = useState(() => createMemory(rng));
  const [cursor, setCursor] = useState(0);
  const [keyboard, setKeyboard] = useState(false);

  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "数", value: String(state.level) },
      { label: "残り", value: String(MAX_MISSES - state.misses) },
    ]);
  }, [state.level, state.misses]);

  const finish = useEffectEvent(() =>
    onFinish({ score: state.best, stats: [{ label: "ミス", value: String(state.misses) }] }),
  );
  useEffect(() => {
    if (state.phase === "cleared" || state.phase === "missed") {
      const wait = state.phase === "cleared" ? CLEARED_PAUSE : MISSED_PAUSE;
      const timer = setTimeout(() => setState((current) => advance(current, rng)), wait);
      return () => clearTimeout(timer);
    }
    if (state.phase === "over") {
      const timer = setTimeout(finish, OVER_PAUSE);
      return () => clearTimeout(timer);
    }
  }, [state.phase, rng]);

  const pressCell = (index: number) => {
    const next = press(state, index);
    if (next === state) return;
    if (next.phase === "missed" || (next.phase === "over" && next.misses > state.misses)) {
      sound.play("bad");
    } else if (next.phase === "cleared" || next.phase === "over") {
      sound.play("good");
    } else {
      sound.play("tap");
    }
    setState(next);
  };

  useGameKeys((event) => {
    const direction = directionFromKey(event.key);
    if (direction) {
      const { dx, dy } = DIRECTIONS[direction];
      setKeyboard(true);
      setCursor((current) => {
        const x = Math.min(COLS - 1, Math.max(0, (current % COLS) + dx));
        const y = Math.min(ROWS - 1, Math.max(0, Math.floor(current / COLS) + dy));
        return y * COLS + x;
      });
      return true;
    }
    if (event.key === " " || event.key === "Enter") {
      setKeyboard(true);
      pressCell(cursor);
      return true;
    }
    return undefined;
  }, true);

  const reveal = state.phase === "show" || state.phase === "missed" || state.phase === "over";

  return (
    <svg
      className="game-svg"
      viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
      role="img"
      aria-label={describe(state)}
    >
      <rect width={COLS * CELL} height={ROWS * CELL} style={{ fill: "var(--bg)" }} />
      {state.cells.map((value, index) => {
        const x = (index % COLS) * CELL;
        const y = Math.floor(index / COLS) * CELL;
        const waiting = value !== null && value >= state.next;
        const wrong = index === state.wrongCell;
        return (
          // マスは盤の位置そのものが識別子
          <g key={`cell-${x}-${y}`} transform={`translate(${x} ${y})`}>
            {waiting ? (
              <>
                <rect
                  x={INSET}
                  y={INSET}
                  width={CELL - INSET * 2}
                  height={CELL - INSET * 2}
                  rx={6}
                  style={{
                    fill: reveal ? "var(--bg-subtle)" : "var(--primary)",
                    stroke: wrong ? "var(--danger)" : reveal ? "var(--line)" : "none",
                    strokeWidth: wrong ? 3 : 1,
                    strokeDasharray: wrong ? "8 6" : undefined,
                  }}
                  vectorEffect="non-scaling-stroke"
                />
                {reveal ? (
                  <text
                    x={CELL / 2}
                    y={CELL / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fill: wrong ? "var(--danger)" : "var(--ink)",
                      font: "600 40px var(--font-mono)",
                    }}
                  >
                    {value}
                  </text>
                ) : null}
              </>
            ) : (
              <circle cx={CELL / 2} cy={CELL / 2} r={3} style={{ fill: "var(--border)" }} />
            )}
            {keyboard && index === cursor ? (
              <rect
                x={INSET - 4}
                y={INSET - 4}
                width={CELL - (INSET - 4) * 2}
                height={CELL - (INSET - 4) * 2}
                rx={8}
                style={{ fill: "none", stroke: "var(--focus)", strokeWidth: 2 }}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <rect
              width={CELL}
              height={CELL}
              style={{ fill: "transparent", cursor: waiting ? "pointer" : "default" }}
              onPointerDown={(event) => {
                event.preventDefault();
                setKeyboard(false);
                setCursor(index);
                pressCell(index);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
