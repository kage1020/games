import { type PointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import { formatDuration } from "@/platform/format.ts";
import { DIRECTIONS, directionFromKey } from "@/sdk/grid.ts";
import { svgPoint, useGameKeys, useGameLoop } from "@/sdk/hooks.ts";
import { createRng } from "@/sdk/rng.ts";
import type { GameProps } from "@/sdk/types.ts";
import { CELL, CellView, LONG_PRESS, LOST_PAUSE, PressRing } from "./CellView.tsx";
import { InfiniteMines } from "./InfiniteMines.tsx";
import {
  adjacentMines,
  createMines,
  flagsLeft,
  isMinesMode,
  type MinesState,
  reveal,
  tick,
  toggleFlag,
} from "./logic.ts";

const MARGIN = 10;
const WON_PAUSE = 700;

function describe(state: MinesState): string {
  switch (state.phase) {
    case "ready":
      return "マスを選んで開く";
    case "playing":
      return `残りの地雷 ${flagsLeft(state)}`;
    case "won":
      return "地雷以外をすべて開けた";
    case "lost":
      return "地雷を踏んだ";
  }
}

interface Press {
  pointer: number;
  cell: number;
  timer: number;
  flagged: boolean;
}

export default function MinesGame(props: GameProps) {
  return props.mode === "infinite" ? <InfiniteMines {...props} /> : <FiniteMines {...props} />;
}

function FiniteMines({ mode, seed, paused, sound, onHud, onFinish }: GameProps) {
  const [rng] = useState(() => createRng(seed));
  const [state, setState] = useState(() => createMines(isMinesMode(mode) ? mode : "easy"));
  const [cursor, setCursor] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const press = useRef<Press | null>(null);
  const [pressing, setPressing] = useState<number | null>(null);
  const { cols, rows } = state;
  const over = state.phase === "won" || state.phase === "lost";

  useGameLoop(
    (dt) => setState((current) => tick(current, dt)),
    !paused && state.phase === "playing",
  );

  const minesText = String(flagsLeft(state));
  const timeText = formatDuration(state.elapsed);
  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "地雷", value: minesText },
      { label: "時間", value: timeText },
    ]);
  }, [minesText, timeText]);

  const revealedCount = state.revealed.filter(Boolean).length;
  const onRevealed = useEffectEvent((count: number) => {
    if (count > 0 && state.phase === "playing") sound.play("tap");
  });
  useEffect(() => {
    onRevealed(revealedCount);
  }, [revealedCount]);

  const onPhase = useEffectEvent((phase: MinesState["phase"]) => {
    if (phase === "won") sound.play("good");
    if (phase === "lost") sound.play("bad");
  });
  useEffect(() => {
    onPhase(state.phase);
  }, [state.phase]);

  const finish = useEffectEvent(() => {
    if (state.phase === "won") onFinish({ score: Math.round(state.elapsed) });
    else onFinish({ score: null, note: "地雷を踏んだ。記録は残らない。" });
  });
  useEffect(() => {
    if (paused || !over) return;
    const timer = setTimeout(finish, state.phase === "won" ? WON_PAUSE : LOST_PAUSE);
    return () => clearTimeout(timer);
  }, [paused, over, state.phase]);

  const open = (cell: number) => setState((current) => reveal(current, cell, rng));
  const flag = (cell: number) => {
    if (over || state.revealed[cell]) return;
    setState((current) => toggleFlag(current, cell));
    sound.play("flag");
  };

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressing(null);
  };

  useEffect(() => {
    if (!paused || !press.current) return;
    window.clearTimeout(press.current.timer);
    press.current = null;
    setPressing(null);
  }, [paused]);

  useEffect(
    () => () => {
      if (press.current) window.clearTimeout(press.current.timer);
    },
    [],
  );

  useGameKeys((event) => {
    const direction = directionFromKey(event.key);
    if (direction) {
      const { dx, dy } = DIRECTIONS[direction];
      setKeyboard(true);
      setCursor((current) => {
        const x = Math.min(cols - 1, Math.max(0, (current % cols) + dx));
        const y = Math.min(rows - 1, Math.max(0, Math.floor(current / cols) + dy));
        return y * cols + x;
      });
      return true;
    }
    if (event.key === " " || event.key === "Enter") {
      setKeyboard(true);
      open(cursor);
      return true;
    }
    if (event.key.toLowerCase() === "f") {
      setKeyboard(true);
      flag(cursor);
      return true;
    }
    return undefined;
  }, !paused && !over);

  const cellAt = (event: PointerEvent<SVGSVGElement>): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svgPoint(svg, event.clientX, event.clientY);
    const x = Math.floor(point.x / CELL);
    const y = Math.floor(point.y / CELL);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    return y * cols + x;
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (paused || over) return;
    const cell = cellAt(event);
    if (cell === null) return;
    event.preventDefault();
    setKeyboard(false);
    setCursor(cell);
    if (event.button === 2) {
      flag(cell);
      return;
    }
    if (event.button !== 0) return;
    cancelPress();
    const current: Press = { pointer: event.pointerId, cell, timer: 0, flagged: false };
    current.timer = window.setTimeout(() => {
      current.flagged = true;
      setPressing(null);
      flag(cell);
    }, LONG_PRESS);
    press.current = current;
    if (!state.revealed[cell]) setPressing(cell);
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const current = press.current;
    if (!current || current.pointer !== event.pointerId) return;
    window.clearTimeout(current.timer);
    press.current = null;
    setPressing(null);
    if (!current.flagged && !paused) open(current.cell);
  };

  const extent = { width: cols * CELL, height: rows * CELL };
  const cells = state.revealed.map((open, cell) => ({
    cell,
    x: (cell % cols) * CELL,
    y: Math.floor(cell / cols) * CELL,
    open,
  }));

  return (
    <svg
      ref={svgRef}
      className="game-svg"
      viewBox={`${-MARGIN} ${-MARGIN} ${extent.width + MARGIN * 2} ${extent.height + MARGIN * 2}`}
      role="img"
      aria-label={describe(state)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(event) => event.preventDefault()}
    >
      <rect
        x={-MARGIN}
        y={-MARGIN}
        width={extent.width + MARGIN * 2}
        height={extent.height + MARGIN * 2}
        style={{ fill: "var(--bg)" }}
      />
      {cells.map(({ cell, x, y, open: isOpen }) => {
        const mine = state.mines?.[cell] === true;
        const flagged = state.flagged[cell] === true;
        const lost = state.phase === "lost";
        return (
          <CellView
            key={`cell-${x}-${y}`}
            x={x}
            y={y}
            open={isOpen}
            count={isOpen ? adjacentMines(state, cell) : 0}
            flagged={flagged}
            mine={
              lost && mine && !flagged ? (cell === state.exploded ? "exploded" : "shown") : "hidden"
            }
            wrongFlag={lost && flagged && !mine}
            cursor={keyboard && cell === cursor && !over}
          />
        );
      })}
      {pressing !== null && !over ? (
        <PressRing x={(pressing % cols) * CELL} y={Math.floor(pressing / cols) * CELL} />
      ) : null}
    </svg>
  );
}
