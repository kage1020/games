import {
  type PointerEvent,
  useEffect,
  useEffectEvent,
  useId,
  useReducer,
  useRef,
  useState,
} from "react";
import { formatDuration, formatNumber } from "@/platform/format.ts";
import { DIRECTIONS, directionFromKey } from "@/sdk/grid.ts";
import { useGameKeys, useGameLoop } from "@/sdk/hooks.ts";
import type { GameProps } from "@/sdk/types.ts";
import { CELL, LONG_PRESS, LOST_PAUSE, RING_DELAY } from "./CellView.tsx";
import { InfiniteBoard } from "./InfiniteBoard.tsx";
import {
  type Cell,
  cellKey,
  createInfinite,
  type InfiniteState,
  reveal,
  tick,
  toggleFlag,
} from "./infinite.ts";
import { boardPoint, clampSpan, follow, zoomAt } from "./infiniteView.ts";

/** 始めたときに映すマスの数（一辺） */
const START_SPAN = 11;
/** これ以上動かしたらマスを押したのではなく盤面を動かしたとみなす（px） */
const PAN_THRESHOLD = 8;
/** + / - キー 1 回で変える倍率 */
const KEY_ZOOM = 1.25;
/** ホイールの 1px あたりの拡大・縮小の強さ */
const WHEEL_RATE = 0.002;
/** 行単位で届くホイールを px にする */
const WHEEL_LINE = 16;

/** 画面に映す範囲 */
interface Frame {
  /** 左上の盤面の位置（マスの単位、小数もある） */
  camera: Cell;
  /** 一辺のマスの数 */
  span: number;
}

interface View extends Frame {
  game: InfiniteState;
  cursor: Cell;
}

type Action =
  | { type: "tick"; dt: number }
  | { type: "move"; dx: number; dy: number }
  | { type: "point"; cell: Cell }
  | { type: "open"; cell?: Cell }
  | { type: "flag"; cell?: Cell }
  | { type: "frame"; frame: Frame }
  | { type: "zoom"; factor: number };

function reduce(view: View, action: Action): View {
  switch (action.type) {
    case "tick": {
      const game = tick(view.game, action.dt);
      return game === view.game ? view : { ...view, game };
    }
    case "move": {
      const cursor = { x: view.cursor.x + action.dx, y: view.cursor.y + action.dy };
      return { ...view, cursor, camera: follow(view.camera, view.span, cursor) };
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
    case "frame":
      return { ...view, ...action.frame };
    case "zoom": {
      const span = clampSpan(view.span * action.factor);
      const anchor = { x: view.cursor.x + 0.5, y: view.cursor.y + 0.5 };
      const camera = zoomAt(view.camera, view.span, anchor, span);
      return { ...view, span, camera: follow(camera, span, view.cursor) };
    }
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
  /** 円を出すまでの待ち、そのあとは旗になるまでの待ち。同時に 1 つしか走らない */
  timer: number;
  flagged: boolean;
  panning: boolean;
  clientX: number;
  clientY: number;
  frame: Frame;
  /** 盤面を映している正方形の一辺（px） */
  size: number;
}

interface Pinch {
  distance: number;
  /** 指の中点にあった盤面の位置。指の中点の下に置き続ける */
  anchor: Cell;
  span: number;
  rect: DOMRect;
}

interface Point {
  x: number;
  y: number;
}

function twoPoints(pointers: Map<number, Point>): [Point, Point] | null {
  const [a, b] = pointers.values();
  return a && b ? [a, b] : null;
}

export function InfiniteMines({ seed, paused, sound, onHud, onFinish }: GameProps) {
  const prefix = `mines-${useId().replace(/[^\w-]/g, "")}`;
  const [view, dispatch] = useReducer(reduce, seed, (initial) => ({
    game: createInfinite(initial),
    cursor: { x: 0, y: 0 },
    camera: { x: -(START_SPAN - 1) / 2, y: -(START_SPAN - 1) / 2 },
    span: START_SPAN,
  }));
  const [keyboard, setKeyboard] = useState(false);
  const [pressing, setPressing] = useState<Cell | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const press = useRef<Press | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);
  const pending = useRef<Frame | null>(null);
  const frameRequest = useRef<number | null>(null);
  const { game, cursor, camera, span } = view;
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

  /** まだ描いていない動きも含めた、いまの範囲 */
  const currentFrame = (): Frame => pending.current ?? { camera, span };

  /** ドラッグ・ピンチ・ホイールで動かした範囲は、次のフレームでまとめて描く */
  const scheduleFrame = (frame: Frame) => {
    pending.current = frame;
    if (frameRequest.current !== null) return;
    frameRequest.current = requestAnimationFrame(() => {
      frameRequest.current = null;
      const next = pending.current;
      pending.current = null;
      if (next) dispatch({ type: "frame", frame: next });
    });
  };

  const flag = (cell?: Cell) => {
    const { x, y } = cell ?? cursor;
    if (over || game.revealed.has(cellKey(x, y))) return;
    dispatch({ type: "flag", cell });
    sound.play("flag");
  };

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressing(null);
  };

  const releasePointer = (pointer: number) => {
    pointers.current.delete(pointer);
    if (pointers.current.size < 2) pinch.current = null;
  };

  useEffect(() => {
    if (!paused) return;
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    pinch.current = null;
    pointers.current.clear();
    setPressing(null);
  }, [paused]);

  useEffect(
    () => () => {
      if (press.current) window.clearTimeout(press.current.timer);
      if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current);
    },
    [],
  );

  const onWheel = useEffectEvent((event: WheelEvent) => {
    const svg = svgRef.current;
    if (paused || !svg) return;
    event.preventDefault();
    const base = currentFrame();
    const anchor = boardPoint(
      svg.getBoundingClientRect(),
      base.camera,
      base.span,
      event.clientX,
      event.clientY,
    );
    if (anchor === null) return;
    const delta =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * WHEEL_LINE : event.deltaY;
    const next = clampSpan(base.span * Math.exp(delta * WHEEL_RATE));
    scheduleFrame({ camera: zoomAt(base.camera, base.span, anchor, next), span: next });
  });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // React の onWheel は passive で既定のスクロールを止められないので、直接受ける
    const listener = (event: WheelEvent) => onWheel(event);
    svg.addEventListener("wheel", listener, { passive: false });
    return () => svg.removeEventListener("wheel", listener);
  }, []);

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
    if (event.key === "+" || event.key === "=") {
      dispatch({ type: "zoom", factor: 1 / KEY_ZOOM });
      return true;
    }
    if (event.key === "-") {
      dispatch({ type: "zoom", factor: KEY_ZOOM });
      return true;
    }
    return undefined;
  }, !paused && !over);

  const startPinch = (rect: DOMRect) => {
    const points = twoPoints(pointers.current);
    if (!points) return;
    cancelPress();
    const [a, b] = points;
    const base = currentFrame();
    const anchor = boardPoint(rect, base.camera, base.span, (a.x + b.x) / 2, (a.y + b.y) / 2);
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    pinch.current = anchor && distance > 0 ? { distance, anchor, span: base.span, rect } : null;
  };

  const movePinch = (current: Pinch) => {
    const points = twoPoints(pointers.current);
    if (!points) return;
    const [a, b] = points;
    const span = clampSpan((current.span * current.distance) / Math.hypot(a.x - b.x, a.y - b.y));
    const { rect } = current;
    const size = Math.min(rect.width, rect.height);
    const left = rect.left + (rect.width - size) / 2;
    const top = rect.top + (rect.height - size) / 2;
    scheduleFrame({
      camera: {
        x: current.anchor.x - (((a.x + b.x) / 2 - left) * span) / size,
        y: current.anchor.y - (((a.y + b.y) / 2 - top) * span) / size,
      },
      span,
    });
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (paused || over) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.button === 0) {
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size >= 2) {
        event.preventDefault();
        if (pointers.current.size === 2) startPinch(rect);
        return;
      }
    }
    const base = currentFrame();
    const point = boardPoint(rect, base.camera, base.span, event.clientX, event.clientY);
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
    const current: Press = {
      pointer: event.pointerId,
      cell,
      timer: 0,
      flagged: false,
      panning: false,
      clientX: event.clientX,
      clientY: event.clientY,
      frame: base,
      size: Math.min(rect.width, rect.height),
    };
    current.timer = window.setTimeout(() => {
      if (!game.revealed.has(cellKey(cell.x, cell.y))) setPressing(cell);
      current.timer = window.setTimeout(() => {
        current.flagged = true;
        setPressing(null);
        flag(cell);
      }, LONG_PRESS - RING_DELAY);
    }, RING_DELAY);
    press.current = current;
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinch.current) {
      movePinch(pinch.current);
      return;
    }
    const current = press.current;
    if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.clientX;
    const dy = event.clientY - current.clientY;
    if (!current.panning) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      window.clearTimeout(current.timer);
      current.panning = true;
      setPressing(null);
    }
    const { camera: from, span: across } = current.frame;
    scheduleFrame({
      camera: {
        x: from.x - (dx * across) / current.size,
        y: from.y - (dy * across) / current.size,
      },
      span: across,
    });
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    releasePointer(event.pointerId);
    const current = press.current;
    if (!current || current.pointer !== event.pointerId) return;
    window.clearTimeout(current.timer);
    press.current = null;
    setPressing(null);
    if (!current.flagged && !current.panning && !paused) {
      dispatch({ type: "open", cell: current.cell });
    }
  };

  const onPointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    releasePointer(event.pointerId);
    cancelPress();
  };

  const left = camera.x * CELL;
  const top = camera.y * CELL;
  const extent = span * CELL;

  return (
    <svg
      ref={svgRef}
      className="game-svg"
      viewBox={`${left} ${top} ${extent} ${extent}`}
      role="img"
      aria-label={describe(game)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <InfiniteBoard
        prefix={prefix}
        revealed={game.revealed}
        flagged={game.flagged}
        seed={game.seed}
        start={game.start}
        over={over}
        exploded={game.exploded}
        camera={camera}
        span={span}
        cursor={keyboard && !over ? cursor : null}
        pressing={pressing}
      />
    </svg>
  );
}
