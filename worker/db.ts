import type { PlayerBest, RankingEntry, RankPosition } from "@shared/api.ts";
import { type GameId, type ScoreOrder, scoreOrder, scoreRule } from "@shared/catalog.ts";

/** D1Database のうち、ここで使う形だけ */
export interface DbStatement {
  bind(...values: unknown[]): DbStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface Db {
  prepare(query: string): DbStatement;
  batch<T = unknown>(statements: DbStatement[]): Promise<{ results: T[] }[]>;
}

interface Board {
  game: GameId;
  mode: string;
  since: number;
}

const aggregate = (order: ScoreOrder) => (order === "desc" ? "MAX" : "MIN");
const direction = (order: ScoreOrder) => (order === "desc" ? "DESC" : "ASC");

/** プレイヤーごとのベストと順位。order はカタログの定数からしか来ない */
function rankedCte(order: ScoreOrder): string {
  return `WITH bests AS (
      SELECT player_key, ${aggregate(order)}(score) AS best
      FROM scores WHERE game = ? AND mode = ? AND played_at >= ?
      GROUP BY player_key
    ),
    ranked AS (
      SELECT player_key, best, RANK() OVER (ORDER BY best ${direction(order)}) AS rank
      FROM bests
    )`;
}

export async function findPlayerName(db: Db, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT name FROM players WHERE key = ?").bind(key).first<{
    name: string;
  }>();
  return row?.name ?? null;
}

function defaultName(key: string): string {
  return `guest-${key.slice(0, 4)}`;
}

/** name が null なら、新しいプレイヤーには既定の名前を付け、いるプレイヤーの名前は変えない */
export async function upsertPlayer(
  db: Db,
  key: string,
  name: string | null,
  now: number,
): Promise<string> {
  const fallback = defaultName(key);
  await db
    .prepare(
      `INSERT INTO players (key, name, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET name = COALESCE(?, players.name), updated_at = ?`,
    )
    .bind(key, name ?? fallback, now, now, name, now)
    .run();
  return (await findPlayerName(db, key)) ?? fallback;
}

/** 名前を既定の名前に戻す */
export async function resetPlayerName(db: Db, key: string, now: number): Promise<string> {
  const name = defaultName(key);
  await db
    .prepare(
      `INSERT INTO players (key, name, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    )
    .bind(key, name, now, now)
    .run();
  return name;
}

/** 同じゲームの直前の記録から cooldown ミリ秒たっていなければ入れずに false を返す。確認と挿入を 1 つの SQL 文で行う */
export async function insertScore(
  db: Db,
  values: {
    key: string;
    game: GameId;
    mode: string;
    score: number;
    playedAt: number;
    now: number;
    cooldown: number;
  },
): Promise<boolean> {
  const { meta } = await db
    .prepare(
      `INSERT INTO scores (game, mode, player_key, score, played_at, created_at)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM scores WHERE player_key = ? AND game = ? AND created_at > ?
       )`,
    )
    .bind(
      values.game,
      values.mode,
      values.key,
      values.score,
      values.playedAt,
      values.now,
      values.key,
      values.game,
      values.now - values.cooldown,
    )
    .run();
  return meta.changes > 0;
}

export async function playerBest(db: Db, key: string, game: GameId, mode: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT ${aggregate(scoreOrder(game, mode))}(score) AS best FROM scores WHERE player_key = ? AND game = ? AND mode = ?`,
    )
    .bind(key, game, mode)
    .first<{ best: number }>();
  return row?.best ?? 0;
}

function positionStatement(db: Db, board: Board, key: string): DbStatement {
  return db
    .prepare(
      `${rankedCte(scoreOrder(board.game, board.mode))}
       SELECT COALESCE((SELECT rank FROM ranked WHERE player_key = ?), 0) AS rank,
              (SELECT COUNT(*) FROM ranked) AS total`,
    )
    .bind(board.game, board.mode, board.since, key);
}

export async function playerPositions(
  db: Db,
  boards: Board[],
  key: string,
): Promise<RankPosition[]> {
  const results = await db.batch<RankPosition>(
    boards.map((board) => positionStatement(db, board, key)),
  );
  return results.map(({ results: [row] }) => ({ rank: row?.rank ?? 0, total: row?.total ?? 0 }));
}

export async function ranking(
  db: Db,
  board: Board,
  key: string | null,
  limit: number,
): Promise<{ rows: (RankingEntry & { me: boolean })[]; me: RankingEntry | null; total: number }> {
  const cte = rankedCte(scoreOrder(board.game, board.mode));
  const params = [board.game, board.mode, board.since];
  const [top, mine, count] = await db.batch<Record<string, number | string>>([
    db
      .prepare(
        `${cte}
         SELECT r.rank AS rank, r.best AS score, p.name AS name, r.player_key = ? AS me
         FROM ranked r JOIN players p ON p.key = r.player_key
         ORDER BY r.rank, p.created_at LIMIT ?`,
      )
      .bind(...params, key ?? "", limit),
    db
      .prepare(
        `${cte}
         SELECT r.rank AS rank, r.best AS score, p.name AS name
         FROM ranked r JOIN players p ON p.key = r.player_key WHERE r.player_key = ?`,
      )
      .bind(...params, key ?? ""),
    db.prepare(`${cte} SELECT COUNT(*) AS total FROM ranked`).bind(...params),
  ]);
  const mineRow = mine?.results[0];
  return {
    rows: (top?.results ?? []).map((row) => ({
      rank: Number(row.rank),
      score: Number(row.score),
      name: String(row.name),
      me: Number(row.me) === 1,
    })),
    me: mineRow
      ? { rank: Number(mineRow.rank), score: Number(mineRow.score), name: String(mineRow.name) }
      : null,
    total: Number(count?.results[0]?.total ?? 0),
  };
}

export async function playerBests(db: Db, key: string): Promise<PlayerBest[]> {
  const { results } = await db
    .prepare(
      `SELECT game, mode, MAX(score) AS high, MIN(score) AS low, COUNT(*) AS plays
       FROM scores WHERE player_key = ? GROUP BY game, mode`,
    )
    .bind(key)
    .all<{ game: GameId; mode: string; high: number; low: number; plays: number }>();
  return results.flatMap((row) => {
    const rule = scoreRule(row.game, row.mode);
    if (rule === null) return [];
    return [
      {
        game: row.game,
        mode: row.mode,
        best: rule.order === "desc" ? row.high : row.low,
        plays: row.plays,
      },
    ];
  });
}
