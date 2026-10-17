import type { Cell } from "./infinite.ts";

/** 画面に映すマスの数（一辺）の範囲。広げすぎると数字が読めず、描くものも増える */
export const MIN_SPAN = 6;
export const MAX_SPAN = 40;
/** カーソルと画面の端の間に空けるマスの数 */
const EDGE = 1;

export function clampSpan(span: number): number {
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, span));
}

/** anchor（盤面の位置）が画面上で動かないように、span を next にしたときの左上を返す */
export function zoomAt(camera: Cell, span: number, anchor: Cell, next: number): Cell {
  const ratio = next / span;
  return {
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
  };
}

/** カーソルが画面の端から EDGE マスより内側に入るように左上を動かす */
export function follow(camera: Cell, span: number, cursor: Cell): Cell {
  const axis = (from: number, at: number) => {
    if (at < from + EDGE) return at - EDGE;
    if (at + 1 > from + span - EDGE) return at + 1 - span + EDGE;
    return from;
  };
  return { x: axis(camera.x, cursor.x), y: axis(camera.y, cursor.y) };
}

/** 画面上の位置を盤面の位置（マスの単位）にする。SVG は正方形を縦横の短いほうに合わせて中央に置く */
export function boardPoint(
  rect: DOMRect,
  camera: Cell,
  span: number,
  clientX: number,
  clientY: number,
): Cell | null {
  const size = Math.min(rect.width, rect.height);
  if (size === 0) return null;
  const left = rect.left + (rect.width - size) / 2;
  const top = rect.top + (rect.height - size) / 2;
  return {
    x: camera.x + ((clientX - left) * span) / size,
    y: camera.y + ((clientY - top) * span) / size,
  };
}
