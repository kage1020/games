import { type RefObject, useEffect, useEffectEvent } from "react";
import type { Direction } from "./grid.ts";

const MAX_STEP = 50;

/** requestAnimationFrame で step(経過ミリ秒) を呼ぶ。running が false の間は止まる */
export function useGameLoop(step: (dt: number) => void, running: boolean): void {
  const onFrame = useEffectEvent(step);
  useEffect(() => {
    if (!running) return;
    let last: number | null = null;
    let frame = 0;
    const tick = (time: number) => {
      // タブを離れた後などの大きな飛びは 1 歩ぶんに抑える
      const dt = last === null ? 0 : Math.min(time - last, MAX_STEP);
      last = time;
      if (dt > 0) onFrame(dt);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function isActivation(event: KeyboardEvent): boolean {
  if (event.key !== " " && event.key !== "Enter") return false;
  return event.target instanceof HTMLElement && event.target.closest("button, a, summary") !== null;
}

/**
 * ゲームのキー操作。入力欄にいるときと、ボタンやリンクの上の Space / Enter は渡さない。
 * onKey が true を返したキーは既定の動き（スクロールなど）を止める。
 */
export function useGameKeys(
  onKey: (event: KeyboardEvent) => boolean | undefined,
  active: boolean,
): void {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.target) || isActivation(event)) return;
    if (onKey(event) === true) event.preventDefault();
  });
  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active]);
}

const SWIPE_DISTANCE = 24;

/** 指やマウスで払った向き。払う面には CSS で touch-action: none を付ける */
export function useSwipe(
  ref: RefObject<HTMLElement | SVGElement | null>,
  onSwipe: (direction: Direction) => void,
  active: boolean,
): void {
  const handle = useEffectEvent(onSwipe);
  useEffect(() => {
    const element = ref.current;
    if (!element || !active) return;
    let start: { x: number; y: number; id: number } | null = null;
    const down = (event: Event) => {
      const e = event as PointerEvent;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const move = (event: Event) => {
      const e = event as PointerEvent;
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
      handle(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
      // 払い続けたら次の向きを取れるように、ここを新しい起点にする
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const up = () => {
      start = null;
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    };
  }, [ref, active]);
}

/** SVG の viewBox 上の座標に変換する */
export function svgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}
