import { describe, expect, it } from "vitest";
import { createRng } from "@/sdk/rng.ts";
import {
  createSnake,
  interval,
  MAX_QUEUE,
  MIN_INTERVAL,
  type Point,
  SIZE,
  type SnakeState,
  START_INTERVAL,
  START_LENGTH,
  step,
  turn,
} from "./logic.ts";

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

function withState(overrides: Partial<SnakeState>): SnakeState {
  return { ...createSnake(createRng(1)), ...overrides };
}

describe("snake", () => {
  it("AC-G-snake-1 starts with length 3 at the center facing right on a 20×20 board", () => {
    const state = createSnake(createRng(1));
    expect(SIZE).toBe(20);
    expect(state.body).toHaveLength(START_LENGTH);
    expect(state.body[0]).toEqual({ x: 10, y: 10 });
    expect(state.body).toEqual([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
    expect(state.direction).toBe("right");
    expect(state.outcome).toBe("playing");
  });

  it("AC-G-snake-1 places one food on an empty cell, decided by the seed", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = createSnake(createRng(seed));
      const food = state.food;
      expect(food).not.toBeNull();
      if (!food) continue;
      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThan(SIZE);
      expect(food.y).toBeGreaterThanOrEqual(0);
      expect(food.y).toBeLessThan(SIZE);
      expect(state.body.some((part) => same(part, food))).toBe(false);
    }
    expect(createSnake(createRng(9)).food).toEqual(createSnake(createRng(9)).food);
  });

  it("AC-G-snake-2 moves the head one cell in its direction each step", () => {
    const state = withState({ food: { x: 0, y: 0 } });
    const next = step(state, createRng(2));
    expect(next.body[0]).toEqual({ x: 11, y: 10 });
    expect(next.body).toHaveLength(START_LENGTH);
    expect(next.body.at(-1)).toEqual({ x: 9, y: 10 });
  });

  it("AC-G-snake-2 ignores turning straight back", () => {
    const state = withState({ food: { x: 0, y: 0 } });
    expect(turn(state, "left")).toBe(state);
    const up = turn(state, "up");
    expect(turn(up, "down")).toBe(up);
  });

  it("AC-G-snake-2 queues up to two turns ahead", () => {
    const state = withState({ food: { x: 0, y: 0 } });
    const queued = turn(turn(turn(state, "up"), "left"), "down");
    expect(MAX_QUEUE).toBe(2);
    expect(queued.queue).toEqual(["up", "left"]);
    const rng = createRng(3);
    const first = step(queued, rng);
    expect(first.body[0]).toEqual({ x: 10, y: 9 });
    expect(first.direction).toBe("up");
    const second = step(first, rng);
    expect(second.body[0]).toEqual({ x: 9, y: 9 });
    expect(second.direction).toBe("left");
    expect(second.queue).toEqual([]);
  });

  it("AC-G-snake-3 grows by one, scores, and moves the food to another empty cell", () => {
    const state = withState({ food: { x: 11, y: 10 } });
    const next = step(state, createRng(4));
    expect(next.body).toHaveLength(START_LENGTH + 1);
    expect(next.eaten).toBe(1);
    const food = next.food;
    expect(food).not.toBeNull();
    if (food) {
      expect(same(food, { x: 11, y: 10 })).toBe(false);
      expect(next.body.some((part) => same(part, food))).toBe(false);
    }
  });

  it("AC-G-snake-4 ends on hitting a wall", () => {
    const state = withState({
      body: [
        { x: 19, y: 3 },
        { x: 18, y: 3 },
        { x: 17, y: 3 },
      ],
      food: { x: 0, y: 0 },
    });
    expect(step(state, createRng(5)).outcome).toBe("crashed");
  });

  it("AC-G-snake-4 ends on hitting its own body", () => {
    const state = withState({
      body: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 5 },
        { x: 4, y: 4 },
      ],
      direction: "left",
      queue: ["down"],
      food: { x: 0, y: 0 },
    });
    expect(step(state, createRng(6)).outcome).toBe("crashed");
  });

  it("AC-G-snake-4 lets the head enter the cell the tail just left", () => {
    const state = withState({
      body: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
      ],
      direction: "left",
      queue: ["down"],
      food: { x: 0, y: 0 },
    });
    const next = step(state, createRng(7));
    expect(next.outcome).toBe("playing");
    expect(next.body[0]).toEqual({ x: 5, y: 6 });
  });

  it("AC-G-snake-4 does not move once over", () => {
    const crashed = withState({ outcome: "crashed" });
    expect(step(crashed, createRng(8))).toBe(crashed);
    expect(turn(crashed, "up")).toBe(crashed);
  });

  it("AC-G-snake-5 shortens the step interval with length down to a floor", () => {
    expect(interval(START_LENGTH)).toBe(START_INTERVAL);
    expect(interval(START_LENGTH + 10)).toBeLessThan(interval(START_LENGTH + 1));
    expect(interval(START_LENGTH + 1)).toBeLessThan(START_INTERVAL);
    expect(interval(400)).toBe(MIN_INTERVAL);
  });

  it("finishes when the snake fills the board", () => {
    const cells: Point[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let i = 0; i < SIZE; i++) cells.push({ x: y % 2 === 0 ? i : SIZE - 1 - i, y });
    }
    const [food, ...rest] = cells;
    const state = withState({ body: rest, direction: "left", queue: [], food: food ?? null });
    const next = step(state, createRng(9));
    expect(next.outcome).toBe("filled");
    expect(next.food).toBeNull();
    expect(next.body).toHaveLength(SIZE * SIZE);
  });
});
