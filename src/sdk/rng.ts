export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [0, n) の整数 */
  int(n: number): number;
  /** [min, max) */
  between(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** 元の配列は変えない */
  shuffle<T>(items: readonly T[]): T[];
}

/** 種から決まる乱数（mulberry32） */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    between: (min, max) => min + next() * (max - min),
    pick: (items) => {
      const item = items[int(items.length)];
      if (item === undefined) throw new Error("pick from an empty list");
      return item;
    },
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [copy[i], copy[j]] = [copy[j] as (typeof copy)[number], copy[i] as (typeof copy)[number]];
      }
      return copy;
    },
  };
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}
