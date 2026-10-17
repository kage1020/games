import { describe, expect, it } from "vitest";
import {
  advance,
  BASE_WIDTH,
  createStack,
  drop,
  PERFECT_TOLERANCE,
  type StackState,
  score,
  speedFor,
} from "./logic.ts";

/** 動くブロックを x の位置に置いた状態 */
function at(state: StackState, x: number): StackState {
  return { ...state, moving: { ...state.moving, x } };
}

describe("stack", () => {
  it("AC-G-stack-1 starts with a base of 60% width and a block of the same width", () => {
    const state = createStack();
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0]?.width).toBeCloseTo(BASE_WIDTH);
    expect(state.moving.width).toBeCloseTo(BASE_WIDTH);
    expect(state.over).toBe(false);
  });

  it("AC-G-stack-1 slides the block and bounces at the edges", () => {
    let state = createStack();
    const startX = state.moving.x;
    state = advance(state, 100);
    expect(state.moving.x).not.toBe(startX);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      state = advance(state, 16);
      seen.add(state.direction);
      expect(state.moving.x).toBeGreaterThanOrEqual(0);
      expect(state.moving.x + state.moving.width).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(seen).toEqual(new Set([1, -1]));
  });

  it("AC-G-stack-1 keeps the block inside even after a long step", () => {
    const state = advance(createStack(), 10_000);
    expect(state.moving.x).toBeGreaterThanOrEqual(0);
    expect(state.moving.x + state.moving.width).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("AC-G-stack-1 moves faster as the stack grows", () => {
    expect(speedFor(5)).toBeGreaterThan(speedFor(0));
    expect(speedFor(20)).toBeGreaterThan(speedFor(5));
    const first = createStack();
    const placed = drop(at(first, (first.blocks[0]?.x ?? 0) + 0.1));
    expect(placed.speed).toBeGreaterThan(first.speed);
  });

  it("AC-G-stack-2 keeps only the overlap with the block below", () => {
    const state = createStack();
    const base = state.blocks[0];
    if (!base) throw new Error("no base");
    const placed = drop(at(state, base.x + 0.2));
    const top = placed.blocks.at(-1);
    expect(placed.blocks).toHaveLength(2);
    expect(top?.x).toBeCloseTo(base.x + 0.2);
    expect(top?.width).toBeCloseTo(BASE_WIDTH - 0.2);
    expect(placed.cut?.width).toBeCloseTo(0.2);
    expect(placed.moving.width).toBeCloseTo(BASE_WIDTH - 0.2);
    expect(placed.over).toBe(false);
  });

  it("AC-G-stack-2 keeps the overlap when the block hangs off the left side", () => {
    const state = createStack();
    const base = state.blocks[0];
    if (!base) throw new Error("no base");
    const placed = drop(at(state, base.x - 0.1));
    expect(placed.blocks.at(-1)?.x).toBeCloseTo(base.x);
    expect(placed.blocks.at(-1)?.width).toBeCloseTo(BASE_WIDTH - 0.1);
  });

  it("AC-G-stack-2 ends when nothing overlaps", () => {
    const state = createStack();
    const base = state.blocks[0];
    if (!base) throw new Error("no base");
    const missed = drop(at(state, base.x + base.width + 0.01));
    expect(missed.over).toBe(true);
    expect(missed.blocks).toHaveLength(1);
    expect(advance(missed, 100)).toBe(missed);
    expect(drop(missed)).toBe(missed);
  });

  it("AC-G-stack-3 snaps a near-perfect drop to the block below", () => {
    const state = createStack();
    const base = state.blocks[0];
    if (!base) throw new Error("no base");
    const placed = drop(at(state, base.x + PERFECT_TOLERANCE));
    expect(placed.blocks.at(-1)).toEqual(base);
    expect(placed.perfects).toBe(1);
    expect(placed.cut).toBeNull();
    const off = drop(at(state, base.x + PERFECT_TOLERANCE + 0.01));
    expect(off.perfects).toBe(0);
    expect(off.blocks.at(-1)?.width).toBeLessThan(BASE_WIDTH);
  });

  it("AC-G-stack-4 counts placed blocks without the base", () => {
    let state = createStack();
    expect(score(state)).toBe(0);
    for (let i = 0; i < 3; i++) {
      const top = state.blocks.at(-1);
      if (!top) throw new Error("no top");
      state = drop(at(state, top.x));
    }
    expect(score(state)).toBe(3);
    const top = state.blocks.at(-1);
    if (!top) throw new Error("no top");
    state = drop(at(state, top.x + top.width + 0.05));
    expect(state.over).toBe(true);
    expect(score(state)).toBe(3);
  });
});
