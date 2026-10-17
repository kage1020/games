import { type PointerEvent, useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { formatDuration, formatNumber } from "@/platform/format.ts";
import { DIRECTIONS, directionFromKey } from "@/sdk/grid.ts";
import { useGameKeys, useGameLoop } from "@/sdk/hooks.ts";
import type { GameProps } from "@/sdk/types.ts";
import { CELL, CellView, LONG_PRESS, LOST_PAUSE } from "./CellView.tsx";
import {
  type Cell,
  cellKey,
  createInfinite,
  type InfiniteState,
  isMine,
  reveal,
  tick,
  toggleFlag,
} from "./infinite.ts";

/** 画面に映すマスの数（一辺） */
const VIEW = 11;
/** カーソルと画面の端の間に空けるマスの数 */
const EDGE = 1;
/** これ以上動かしたらマスを押したのではなく盤面を動かしたとみなす（px） */
const PAN_THRESHOLD = 8;

interface View {
  game: InfiniteState;
  cursor: Cell;
  /** 画面の左上に映す盤面の位置（マスの単位、小数もある） */
  camera: Cell;
}

type Action =
  | { type: "tick"; dt: number }
  | { type: "move"; dx: number; dy: number }
  | { type: "point"; cell: Cell }
  | { type: "open"; cell?: Cell }
  | { type: "flag"; cell?: Cell }
  | { type: "pan"; camera: Cell };

/** カーソルが画面の端から EDGE マスより内側に入るように画面を動かす */
function follow(camera: Cell, cursor: Cell): Cell {
  const axis = (from: number, at: number) => {
    if (at < from + EDGE) return at - EDGE;
    if (at + 1 > from + VIEW - EDGE) return at + 1 - VIEW + EDGE;
    return from;
  };
  return { x: axis(camera.x, cursor.x), y: axis(camera.y, cursor.y) };
}

function reduce(view: View, action: Action): View {
  switch (action.type) {
    case "tick": {
      const game = tick(view.game, action.dt);
      return game === view.game ? view : { ...view, game };
    }
    case "move": {
      const cursor = { x: view.cursor.x + action.dx, y: view.cursor.y + action.dy };
      return { ...view, cursor, camera: follow(view.camera, cursor) };
    }
    case "point":
      return { ...view, cursor: action.cell };
    case "open": {
      const { x, y } = action.cell ?? view.cursor;
      return { ...view, game: reveal(view.game, x, y) };
    }
    case "flag": {
      const { x, y } = action.cell ?? view.cursor;
      return { ...view, game: toggleFlag(view.game, x, y) };
    }
    case "pan":
      return { ...view, camera: action.camera };
  }
}

function describe(game: InfiniteState): string {
  switch (game.phase) {
    case "ready":
      return "マスを選んで開く";
    case "playing":
      return `開いたマス ${formatNumber(game.revealed.size)}`;
    case "lost":
      return "地雷を踏んだ";
  }
}

interface Press {
  pointer: number;
  cell: Cell;
  timer: number;
  flagged: boolean;
  panning: boolean;
  clientX: number;
  clientY: number;
  camera: Cell;
  /** 盤面を映している正方形の一辺（px） */
  size: number;
}

/** 画面上の位置を盤面の位置（マスの単位）にする。SVG は正方形を縦横の短いほうに合わせて中央に置く */
function boardPoint(rect: DOMRect, camera: Cell, clientX: number, clientY: number): Cell | null {
  const size = Math.min(rect.width, rect.height);
  if (size === 0) return null;
  const left = rect.left + (rect.width - size) / 2;
  const top = rect.top + (rect.height - size) / 2;
  return {
    x: camera.x + ((clientX - left) * VIEW) / size,
    y: camera.y + ((clientY - top) * VIEW) / size,
  };
}

export function InfiniteMines({ seed, paused, sound, onHud, onFinish }: GameProps) {
  const [view, dispatch] = useReducer(reduce, seed, (initial) => ({
    game: createInfinite(initial),
    cursor: { x: 0, y: 0 },
    camera: { x: -(VIEW - 1) / 2, y: -(VIEW - 1) / 2 },
  }));
  const [keyboard, setKeyboard] = useState(false);
  const press = useRef<Press | null>(null);
  const { game, cursor, camera } = view;
  const over = game.phase === "lost";

  useGameLoop((dt) => dispatch({ type: "tick", dt }), !paused && game.phase === "playing");

  const openedText = formatNumber(game.revealed.size);
  const timeText = formatDuration(game.elapsed);
  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "開いたマス", value: openedText },
      { label: "時間", value: timeText },
    ]);
  }, [openedText, timeText]);

  const opened = game.revealed.size;
  const onOpened = useEffectEvent((count: number) => {
    if (count > 0 && game.phase === "playing") sound.play("tap");
  });
  useEffect(() => {
    onOpened(opened);
  }, [opened]);

  const onPhase = useEffectEvent((phase: InfiniteState["phase"]) => {
    if (phase === "lost") sound.play("bad");
  });
  useEffect(() => {
    onPhase(game.phase);
  }, [game.phase]);

  const finish = useEffectEvent(() =>
    onFinish({
      score: game.revealed.size,
      stats: [{ label: "時間", value: formatDuration(game.elapsed) }],
    }),
  );
  useEffect(() => {
    if (paused || !over) return;
    const timer = setTimeout(finish, LOST_PAUSE);
    return () => clearTimeout(timer);
  }, [paused, over]);

  const flag = (cell?: Cell) => {
    dispatch({ type: "flag", cell });
    sound.play("tap");
  };

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  useEffect(() => {
    if (!paused || !press.current) return;
    window.clearTimeout(press.current.timer);
    press.current = null;
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
      setKeyboard(true);
      dispatch({ type: "move", ...DIRECTIONS[direction] });
      return true;
    }
    if (event.key === " " || event.key === "Enter") {
      setKeyboard(true);
      dispatch({ type: "open" });
      return true;
    }
    if (event.key.toLowerCase() === "f") {
      setKeyboard(true);
      flag();
      return true;
    }
    return undefined;
  }, !paused && !over);

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (paused || over) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = boardPoint(rect, camera, event.clientX, event.clientY);
    if (point === null) return;
    event.preventDefault();
    const cell = { x: Math.floor(point.x), y: Math.floor(point.y) };
    setKeyboard(false);
    dispatch({ type: "point", cell });
    if (event.button === 2) {
      flag(cell);
      return;
    }
    if (event.button !== 0) return;
    cancelPress();
    event.currentTarget.setPointerCapture(event.pointerId);
    const current: Press = {
      pointer: event.pointerId,
      cell,
      timer: 0,
      flagged: false,
      panning: false,
      clientX: event.clientX,
      clientY: event.clientY,
      camera,
      size: Math.min(rect.width, rect.height),
    };
    current.timer = window.setTimeout(() => {
      current.flagged = true;
      flag(cell);
    }, LONG_PRESS);
    press.current = current;
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const current = press.current;
    if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.clientX;
    const dy = event.clientY - current.clientY;
    if (!current.panning) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      window.clearTimeout(current.timer);
      current.panning = true;
    }
    dispatch({
      type: "pan",
      camera: {
        x: current.camera.x - (dx * VIEW) / current.size,
        y: current.camera.y - (dy * VIEW) / current.size,
      },
    });
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const current = press.current;
    if (!current || current.pointer !== event.pointerId) return;
    window.clearTimeout(current.timer);
    press.current = null;
    if (!current.flagged && !current.panning && !paused) {
      dispatch({ type: "open", cell: current.cell });
    }
  };

  const cells: Cell[] = [];
  for (let y = Math.floor(camera.y); y < camera.y + VIEW; y++) {
    for (let x = Math.floor(camera.x); x < camera.x + VIEW; x++) cells.push({ x, y });
  }
  const left = camera.x * CELL;
  const top = camera.y * CELL;
  const extent = VIEW * CELL;

  return (
    <svg
      className="game-svg"
      viewBox={`${left} ${top} ${extent} ${extent}`}
      role="img"
      aria-label={describe(game)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelPress}
      onContextMenu={(event) => event.preventDefault()}
    >
      <rect x={left} y={top} width={extent} height={extent} style={{ fill: "var(--bg)" }} />
      {cells.map(({ x, y }) => {
        const key = cellKey(x, y);
        const count = game.revealed.get(key);
        const flagged = game.flagged.has(key);
        const mine = over && isMine(game, x, y);
        const exploded = game.exploded?.x === x && game.exploded.y === y;
        return (
          <CellView
            key={key}
            x={x * CELL}
            y={y * CELL}
            open={count !== undefined}
            count={count ?? 0}
            flagged={flagged}
            mine={mine && !flagged ? (exploded ? "exploded" : "shown") : "hidden"}
            wrongFlag={over && flagged && !mine}
            cursor={keyboard && !over && cursor.x === x && cursor.y === y}
          />
        );
      })}
    </svg>
  );
}
