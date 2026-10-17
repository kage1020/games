import { describe, expect, it } from "vitest";
import {
  boardPoint,
  clampSpan,
  follow,
  frameSize,
  MAX_SPAN,
  MIN_SPAN,
  zoomAt,
} from "./infiniteView.ts";

const rect = DOMRect.fromRect({ x: 20, y: 40, width: 600, height: 600 });

describe("infinite view", () => {
  it("AC-G-mines-14 keeps the span between 6 and 40 cells", () => {
    expect(MIN_SPAN).toBe(6);
    expect(MAX_SPAN).toBe(40);
    expect(clampSpan(2)).toBe(6);
    expect(clampSpan(17)).toBe(17);
    expect(clampSpan(90)).toBe(40);
  });

  it("AC-G-mines-14 keeps the anchor at the same place on screen", () => {
    const center = { x: 0.5, y: 0.5 };
    const anchor = { x: 1.5, y: -2.25 };
    for (const span of [6, 20, 40]) {
      const next = zoomAt(center, 11, anchor, span);
      const before = { x: (anchor.x - center.x) / 11, y: (anchor.y - center.y) / 11 };
      const after = { x: (anchor.x - next.x) / span, y: (anchor.y - next.y) / span };
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
    }
  });

  it("maps screen points to board points around the middle of the screen", () => {
    const center = { x: 0.5, y: 0.5 };
    expect(boardPoint(rect, center, 11, 320, 340)).toEqual({ x: 0.5, y: 0.5 });
    expect(boardPoint(rect, center, 11, 20, 40)).toEqual({ x: -5, y: -5 });
    expect(boardPoint(rect, center, 11, 620, 640)).toEqual({ x: 6, y: 6 });
    expect(boardPoint(DOMRect.fromRect({ width: 0, height: 0 }), center, 10, 1, 1)).toBeNull();
  });

  it("AC-G-mines-16 sizes cells by the shorter side and shows more along the longer one", () => {
    expect(frameSize(11, 1)).toEqual({ width: 11, height: 11 });
    expect(frameSize(10, 2)).toEqual({ width: 20, height: 10 });
    expect(frameSize(10, 0.5)).toEqual({ width: 10, height: 20 });
    const wide = DOMRect.fromRect({ x: 0, y: 0, width: 800, height: 400 });
    const center = { x: 0, y: 0 };
    expect(boardPoint(wide, center, 10, 0, 0)).toEqual({ x: -10, y: -5 });
    expect(boardPoint(wide, center, 10, 800, 400)).toEqual({ x: 10, y: 5 });
    expect(boardPoint(wide, center, 10, 400, 200)).toEqual({ x: 0, y: 0 });
  });

  it("AC-G-mines-11 follows the cursor with a one-cell margin for any span and shape", () => {
    const square = { width: 11, height: 11 };
    expect(follow({ x: 0.5, y: 0.5 }, square, { x: 0, y: 0 })).toEqual({ x: 0.5, y: 0.5 });
    expect(follow({ x: 0.5, y: 0.5 }, square, { x: 6, y: 0 })).toEqual({ x: 2.5, y: 0.5 });
    expect(follow({ x: 15, y: 15 }, { width: 30, height: 30 }, { x: -1, y: 29 })).toEqual({
      x: 13,
      y: 16,
    });
    const wide = { width: 20, height: 10 };
    expect(follow({ x: 0, y: 0 }, wide, { x: 8, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(follow({ x: 0, y: 0 }, wide, { x: 9, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(follow({ x: 0, y: 0 }, wide, { x: 0, y: 5 })).toEqual({ x: 0, y: 2 });
  });
});
