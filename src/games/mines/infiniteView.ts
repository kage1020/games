import type { Cell } from "./infinite.ts";

/** 短いほうの辺に並べるマスの数の範囲。広げすぎると数字が読めず、描くものも増える */
export const MIN_SPAN = 6;
export const MAX_SPAN = 40;
/** カーソルと画面の端の間に空けるマスの数 */
const EDGE = 1;

/** 縦横に並ぶマスの数（小数もある） */
export interface FrameSize {
  width: number;
  height: number;
}

export function clampSpan(span: number): number {
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, span));
}

/** 短いほうの辺に span マス並べたときの縦横のマスの数。aspect は画面の横 / 縦 */
export function frameSize(span: number, aspect: number): FrameSize {
  return aspect >= 1
    ? { width: span * aspect, height: span }
    : { width: span, height: span / aspect };
}

/** anchor（盤面の位置）が画面上で動かないように、span を next にしたときの真ん中を返す */
export function zoomAt(center: Cell, span: number, anchor: Cell, next: number): Cell {
  const ratio = next / span;
  return {
    x: anchor.x - (anchor.x - center.x) * ratio,
    y: anchor.y - (anchor.y - center.y) * ratio,
  };
}

/** カーソルが画面の端から EDGE マスより内側に入るように真ん中を動かす */
export function follow(center: Cell, size: FrameSize, cursor: Cell): Cell {
  const axis = (middle: number, length: number, at: number) => {
    const from = middle - length / 2;
    if (at < from + EDGE) return at - EDGE + length / 2;
    if (at + 1 > from + length - EDGE) return at + 1 + EDGE - length / 2;
    return middle;
  };
  return { x: axis(center.x, size.width, cursor.x), y: axis(center.y, size.height, cursor.y) };
}

/** 画面上の位置を盤面の位置（マスの単位）にする。マスの大きさは短いほうの辺で決まる */
export function boardPoint(
  rect: DOMRect,
  center: Cell,
  span: number,
  clientX: number,
  clientY: number,
): Cell | null {
  const size = Math.min(rect.width, rect.height);
  if (size === 0) return null;
  return {
    x: center.x + ((clientX - rect.left - rect.width / 2) * span) / size,
    y: center.y + ((clientY - rect.top - rect.height / 2) * span) / size,
  };
}
