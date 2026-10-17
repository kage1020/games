export type Direction = "up" | "down" | "left" | "right";

export const DIRECTIONS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function toIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function fromIndex(index: number, width: number): { x: number; y: number } {
  return { x: index % width, y: Math.floor(index / width) };
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

/** 上下左右で盤の中にあるマス */
export function neighbors4(index: number, width: number, height: number): number[] {
  const { x, y } = fromIndex(index, width);
  return Object.values(DIRECTIONS)
    .map(({ dx, dy }) => ({ x: x + dx, y: y + dy }))
    .filter((p) => inBounds(p.x, p.y, width, height))
    .map((p) => toIndex(p.x, p.y, width));
}

/** 矢印キーと WASD を向きにする */
export function directionFromKey(key: string): Direction | null {
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case "ArrowUp":
    case "w":
      return "up";
    case "ArrowDown":
    case "s":
      return "down";
    case "ArrowLeft":
    case "a":
      return "left";
    case "ArrowRight":
    case "d":
      return "right";
    default:
      return null;
  }
}
