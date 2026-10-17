import { DIRECTIONS, type Direction, OPPOSITE } from "@/sdk/grid.ts";
import type { Rng } from "@/sdk/rng.ts";

export const SIZE = 16;
export const STEP_MS = 150;
export const DURATION_MS = 60_000;
export const TOTAL_STEPS = DURATION_MS / STEP_MS;

export interface Player {
  /** P1〜P4 の番号。盤に描く印と凡例に使う */
  number: number;
  x: number;
  y: number;
  direction: Direction;
  cpu: boolean;
}

export interface TerritoryState {
  /** マスごとの持ち主（プレイヤーの番号 0〜3）。null はだれのものでもない */
  owners: (number | null)[];
  players: Player[];
  stepsLeft: number;
  over: boolean;
}

/** 左上・右下・右上・左下の順。2×2 のうち内側の角から、盤の中央へ向かって始める */
const STARTS: { x: number; y: number; direction: Direction }[] = [
  { x: 1, y: 1, direction: "right" },
  { x: SIZE - 2, y: SIZE - 2, direction: "left" },
  { x: SIZE - 2, y: 1, direction: "down" },
  { x: 1, y: SIZE - 2, direction: "up" },
];

const at = (x: number, y: number) => y * SIZE + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

export function playerCount(mode: string): number {
  const count = Number.parseInt(mode.replace(/^p/, ""), 10);
  return Number.isNaN(count) ? 4 : Math.min(4, Math.max(2, count));
}

export function createTerritory(count: number): TerritoryState {
  const owners: (number | null)[] = Array.from({ length: SIZE * SIZE }, () => null);
  const players = STARTS.slice(0, count).map((start, index) => {
    const left = start.x === 1 ? 0 : SIZE - 2;
    const top = start.y === 1 ? 0 : SIZE - 2;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) owners[at(left + dx, top + dy)] = index;
    }
    return { ...start, number: index + 1, cpu: index > 0 };
  });
  return { owners, players, stepsLeft: TOTAL_STEPS, over: false };
}

export function countCells(owners: (number | null)[], player: number): number {
  return owners.reduce<number>((sum, owner) => (owner === player ? sum + 1 : sum), 0);
}

/** 記録はあなた（プレイヤー 0）のマスの数 */
export function score(state: TerritoryState): number {
  return countCells(state.owners, 0);
}

/** 盤の外から player 以外のマスを通ってたどれないマスを player のものにする */
export function claimEnclosed(owners: (number | null)[], player: number): (number | null)[] {
  const reached = new Uint8Array(SIZE * SIZE);
  const queue: number[] = [];
  const visit = (x: number, y: number) => {
    const cell = at(x, y);
    if (reached[cell] || owners[cell] === player) return;
    reached[cell] = 1;
    queue.push(cell);
  };
  for (let i = 0; i < SIZE; i++) {
    visit(i, 0);
    visit(i, SIZE - 1);
    visit(0, i);
    visit(SIZE - 1, i);
  }
  while (queue.length > 0) {
    const cell = queue.pop() as number;
    const x = cell % SIZE;
    const y = Math.floor(cell / SIZE);
    for (const { dx, dy } of Object.values(DIRECTIONS)) {
      if (inside(x + dx, y + dy)) visit(x + dx, y + dy);
    }
  }
  let changed = false;
  const next = owners.map((owner, cell) => {
    if (owner === player || reached[cell]) return owner;
    changed = true;
    return player;
  });
  return changed ? next : owners;
}

export function steer(state: TerritoryState, direction: Direction): TerritoryState {
  const you = state.players[0];
  if (state.over || !you || you.direction === direction) return state;
  return { ...state, players: [{ ...you, direction }, ...state.players.slice(1)] };
}

/** CPU の向き。盤の外へ向かわず、すぐには戻らない。取れるマスの多い向きを好み、少し揺らぐ */
function cpuDirection(state: TerritoryState, index: number, rng: Rng): Direction {
  const player = state.players[index] as Player;
  const options = (Object.keys(DIRECTIONS) as Direction[]).filter((direction) => {
    const { dx, dy } = DIRECTIONS[direction];
    return direction !== OPPOSITE[player.direction] && inside(player.x + dx, player.y + dy);
  });
  if (options.length === 0) return OPPOSITE[player.direction];
  if (rng.next() < 0.08) return rng.pick(options);
  let best = options[0] as Direction;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const direction of options) {
    const { dx, dy } = DIRECTIONS[direction];
    let score = direction === player.direction ? 0.6 : 0;
    for (let reach = 1; reach <= 3; reach++) {
      const x = player.x + dx * reach;
      const y = player.y + dy * reach;
      if (!inside(x, y)) break;
      const owner = state.owners[at(x, y)];
      const value = owner === index ? 0 : owner === null ? 2 : 2.5;
      score += value / reach;
    }
    score += rng.next() * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = direction;
    }
  }
  return best;
}

export function step(state: TerritoryState, rng: Rng): TerritoryState {
  if (state.over) return state;
  let owners = [...state.owners];
  const players = state.players.map((player, index) => {
    const direction = player.cpu ? cpuDirection(state, index, rng) : player.direction;
    const { dx, dy } = DIRECTIONS[direction];
    const x = player.x + dx;
    const y = player.y + dy;
    if (!inside(x, y)) return { ...player, direction };
    owners[at(x, y)] = index;
    return { ...player, x, y, direction };
  });
  for (let index = 0; index < players.length; index++) owners = claimEnclosed(owners, index);
  const stepsLeft = state.stepsLeft - 1;
  return { owners, players, stepsLeft, over: stepsLeft <= 0 };
}
