import { describe, expect, it } from "vitest";
import { boardPoint, clampSpan, follow, MAX_SPAN, MIN_SPAN, zoomAt } from "./infiniteView.ts";

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
    const camera = { x: -5, y: -5 };
    const anchor = { x: 1.5, y: -2.25 };
    for (const span of [6, 20, 40]) {
      const next = zoomAt(camera, 11, anchor, span);
      const before = { x: (anchor.x - camera.x) / 11, y: (anchor.y - camera.y) / 11 };
      const after = { x: (anchor.x - next.x) / span, y: (anchor.y - next.y) / span };
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
    }
  });

  it("maps screen points to board points through the camera and span", () => {
    expect(boardPoint(rect, { x: -5, y: -5 }, 11, 20, 40)).toEqual({ x: -5, y: -5 });
    expect(boardPoint(rect, { x: -5, y: -5 }, 11, 620, 640)).toEqual({ x: 6, y: 6 });
    expect(boardPoint(rect, { x: 0, y: 0 }, 30, 320, 340)).toEqual({ x: 15, y: 15 });
    const wide = DOMRect.fromRect({ x: 0, y: 0, width: 800, height: 600 });
    expect(boardPoint(wide, { x: 0, y: 0 }, 10, 100, 0)).toEqual({ x: 0, y: 0 });
    expect(
      boardPoint(DOMRect.fromRect({ width: 0, height: 0 }), { x: 0, y: 0 }, 10, 1, 1),
    ).toBeNull();
  });

  it("AC-G-mines-11 follows the cursor with a one-cell margin for any span", () => {
    expect(follow({ x: -5, y: -5 }, 11, { x: 0, y: 0 })).toEqual({ x: -5, y: -5 });
    expect(follow({ x: -5, y: -5 }, 11, { x: 6, y: 0 })).toEqual({ x: -3, y: -5 });
    expect(follow({ x: 0, y: 0 }, 30, { x: -1, y: 29 })).toEqual({ x: -2, y: 1 });
  });
});
