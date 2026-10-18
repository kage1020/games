import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
} from "react";
import { DIRECTIONS, directionFromKey } from "@/sdk/grid.ts";
import { useGameKeys, useGameLoop } from "@/sdk/hooks.ts";
import type { Sound } from "@/sdk/types.ts";
import { CELL, LONG_PRESS, RING_DELAY } from "./CellView.tsx";
import type { Cell } from "./infinite.ts";
import type { InfiniteProgress } from "./infiniteSave.ts";
import { boardPoint, clampSpan, follow, frameSize, zoomAt } from "./infiniteView.ts";

/** 始めたときに短いほうの辺に並べるマスの数 */
const START_SPAN = 11;
/** これ以上動かしたらマスを押したのではなく盤面を動かしたとみなす（px） */
const PAN_THRESHOLD = 8;
/** + / - キー 1 回で変える倍率 */
const KEY_ZOOM = 1.25;
/** ホイールの 1px あたりの拡大・縮小の強さ */
const WHEEL_RATE = 0.002;
/** 行単位で届くホイールを px にする */
const WHEEL_LINE = 16;

/** 端のない盤面のルール。開き方・旗・時間の進め方と終わりがモードで違う */
export interface BoardRules<S> {
  reveal(state: S, x: number, y: number): S;
  toggleFlag(state: S, x: number, y: number): S;
  /** 旗を立て外しできるマス。長押しの円もこのマスにだけ出す */
  canToggleFlag(state: S, x: number, y: number): boolean;
  tick(state: S, dt: number): S;
  /** 時間が進む間 */
  isPlaying(state: S): boolean;
  /** 終わって、もう操作を受けない */
  isOver(state: S): boolean;
}

/** はじめから遊ぶときの途中。カーソルを最初に開くマスに置く */
export function freshProgress<S>(game: S): InfiniteProgress<S> {
  return { game, cursor: { x: 0, y: 0 }, center: { x: 0.5, y: 0.5 }, span: START_SPAN };
}

/** 画面に映す範囲 */
interface Frame {
  /** 画面の真ん中に映す盤面の位置（マスの単位、小数もある） */
  center: Cell;
  /** 短いほうの辺に並べるマスの数 */
  span: number;
}

interface View<S> extends InfiniteProgress<S> {
  /** 画面の横 / 縦 */
  aspect: number;
}

type Action<S> =
  | { type: "tick"; dt: number }
  | { type: "move"; dx: number; dy: number }
  | { type: "point"; cell: Cell }
  | { type: "open"; cell?: Cell }
  | { type: "flag"; cell?: Cell }
  | { type: "frame"; frame: Frame }
  | { type: "zoom"; factor: number }
  | { type: "resize"; aspect: number }
  | { type: "update"; change: (game: S) => S };

function withGame<S>(view: View<S>, game: S): View<S> {
  return game === view.game ? view : { ...view, game };
}

function reduce<S>(rules: BoardRules<S>, view: View<S>, action: Action<S>): View<S> {
  switch (action.type) {
    case "tick":
      return withGame(view, rules.tick(view.game, action.dt));
    case "move": {
      const cursor = { x: view.cursor.x + action.dx, y: view.cursor.y + action.dy };
      const center = follow(view.center, frameSize(view.span, view.aspect), cursor);
      return { ...view, cursor, center };
    }
    case "point":
      return { ...view, cursor: action.cell };
    case "open": {
      const { x, y } = action.cell ?? view.cursor;
      return withGame(view, rules.reveal(view.game, x, y));
    }
    case "flag": {
      const { x, y } = action.cell ?? view.cursor;
      return withGame(view, rules.toggleFlag(view.game, x, y));
    }
    case "frame":
      return { ...view, ...action.frame };
    case "zoom": {
      const span = clampSpan(view.span * action.factor);
      const anchor = { x: view.cursor.x + 0.5, y: view.cursor.y + 0.5 };
      const center = zoomAt(view.center, view.span, anchor, span);
      return { ...view, span, center: follow(center, frameSize(span, view.aspect), view.cursor) };
    }
    case "resize":
      return action.aspect === view.aspect ? view : { ...view, aspect: action.aspect };
    case "update":
      return withGame(view, action.change(view.game));
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
  /** 画面の短いほうの辺（px） */
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

/**
 * 端のない盤面を映して操作する。ドラッグ・ピンチ・ホイール・キーで画面を動かし、押す・長押し・キーで
 * rules に沿って開いたり旗を立てたりする。返す svg を game-svg の SVG に、area・cursor・pressing を
 * InfiniteBoard に渡す
 */
export function useInfiniteView<S>(
  rules: BoardRules<S>,
  initial: () => InfiniteProgress<S>,
  { paused, sound }: { paused: boolean; sound: Sound },
) {
  const [view, dispatch] = useReducer(
    (current: View<S>, action: Action<S>) => reduce(rules, current, action),
    undefined,
    (): View<S> => ({ ...initial(), aspect: 1 }),
  );
  const [keyboard, setKeyboard] = useState(false);
  const [pressing, setPressing] = useState<Cell | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const press = useRef<Press | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);
  const pending = useRef<Frame | null>(null);
  const frameRequest = useRef<number | null>(null);
  const { game, cursor, center, span, aspect } = view;
  const over = rules.isOver(game);

  useGameLoop((dt) => dispatch({ type: "tick", dt }), !paused && rules.isPlaying(game));

  /** まだ描いていない動きも含めた、いまの範囲 */
  const currentFrame = (): Frame => pending.current ?? { center, span };

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
    if (!rules.canToggleFlag(game, x, y)) return;
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
      base.center,
      base.span,
      event.clientX,
      event.clientY,
    );
    if (anchor === null) return;
    const delta =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * WHEEL_LINE : event.deltaY;
    const next = clampSpan(base.span * Math.exp(delta * WHEEL_RATE));
    scheduleFrame({ center: zoomAt(base.center, base.span, anchor, next), span: next });
  });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // React の onWheel は passive で既定のスクロールを止められないので、直接受ける
    const listener = (event: WheelEvent) => onWheel(event);
    svg.addEventListener("wheel", listener, { passive: false });
    return () => svg.removeEventListener("wheel", listener);
  }, []);

  // 描画領域の形に合わせて映す範囲を広げる。大きさが 0 の間は前の形のまま
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries.at(-1)?.contentRect;
      if (box && box.width > 0 && box.height > 0) {
        dispatch({ type: "resize", aspect: box.width / box.height });
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
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
    const anchor = boardPoint(rect, base.center, base.span, (a.x + b.x) / 2, (a.y + b.y) / 2);
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    pinch.current = anchor && distance > 0 ? { distance, anchor, span: base.span, rect } : null;
  };

  const movePinch = (current: Pinch) => {
    const points = twoPoints(pointers.current);
    if (!points) return;
    const [a, b] = points;
    const next = clampSpan((current.span * current.distance) / Math.hypot(a.x - b.x, a.y - b.y));
    const { rect } = current;
    const size = Math.min(rect.width, rect.height);
    const middle = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    scheduleFrame({
      center: {
        x: current.anchor.x - (((a.x + b.x) / 2 - middle.x) * next) / size,
        y: current.anchor.y - (((a.y + b.y) / 2 - middle.y) * next) / size,
      },
      span: next,
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
    const point = boardPoint(rect, base.center, base.span, event.clientX, event.clientY);
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
      if (rules.canToggleFlag(game, cell.x, cell.y)) setPressing(cell);
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
    const { center: from, span: across } = current.frame;
    scheduleFrame({
      center: {
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

  const size = frameSize(span, aspect);
  const left = center.x - size.width / 2;
  const top = center.y - size.height / 2;

  return {
    game,
    center,
    span,
    cursor,
    /** モードだけの操作（終えるなど）で盤面を変える */
    update: (change: (game: S) => S) => dispatch({ type: "update", change }),
    svg: {
      ref: svgRef,
      viewBox: `${left * CELL} ${top * CELL} ${size.width * CELL} ${size.height * CELL}`,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onContextMenu: (event: MouseEvent<SVGSVGElement>) => event.preventDefault(),
    },
    area: { left, top, width: size.width, height: size.height },
    /** キー操作のカーソル。キーで動かしていないときと終わったあとは null */
    shownCursor: keyboard && !over ? cursor : null,
    pressing: over ? null : pressing,
  };
}
