import { describe, expect, it } from "vitest";
import { directionFromKey, fromIndex, neighbors4, toIndex } from "./grid.ts";
import { createRng } from "./rng.ts";

describe("createRng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const sa = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(sa);
    for (const value of sa) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("draws integers in range and shuffles without losing items", () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const n = rng.int(5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
    }
    const items = [1, 2, 3, 4, 5, 6];
    expect(rng.shuffle(items).sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rng.between(10, 20)).toBeGreaterThanOrEqual(10);
  });
});

describe("grid", () => {
  it("converts between indexes and coordinates", () => {
    expect(toIndex(2, 1, 8)).toBe(10);
    expect(fromIndex(10, 8)).toEqual({ x: 2, y: 1 });
  });

  it("lists orthogonal neighbors inside the board", () => {
    expect(neighbors4(0, 3, 3).sort()).toEqual([1, 3]);
    expect(neighbors4(4, 3, 3).sort()).toEqual([1, 3, 5, 7]);
    expect(neighbors4(8, 3, 3).sort()).toEqual([5, 7]);
  });

  it("reads arrows and WASD as directions", () => {
    expect(directionFromKey("ArrowUp")).toBe("up");
    expect(directionFromKey("w")).toBe("up");
    expect(directionFromKey("A")).toBe("left");
    expect(directionFromKey("s")).toBe("down");
    expect(directionFromKey("ArrowRight")).toBe("right");
    expect(directionFromKey("x")).toBeNull();
  });
});
