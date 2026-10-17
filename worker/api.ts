import type { MeResponse, RankingResponse, ScoreResponse } from "@shared/api.ts";
import { isGameId, isValidMode, isValidScore } from "@shared/catalog.ts";
import { normalizeName } from "@shared/name.ts";
import { isPeriod, PERIODS, periodStart } from "@shared/period.ts";
import { playerKey, requirePlayerKey } from "./auth.ts";
import {
  type Db,
  findPlayerName,
  insertScore,
  playerBest,
  playerBests,
  playerPositions,
  ranking,
  resetPlayerName,
  upsertPlayer,
} from "./db.ts";
import { ApiError, errorResponse, json, readJson } from "./http.ts";

export interface ApiDeps {
  db: Db;
  limiter: { limit(options: { key: string }): Promise<{ success: boolean }> };
  now: () => number;
}

const COOLDOWN = 2_000;
const STALE_AFTER = 7 * 86_400_000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type Handler = (request: Request, deps: ApiDeps) => Promise<Response>;

/** プレイヤーキーはクライアントでいくらでも作れるので、送信元 IP でも数える */
async function checkLimit(deps: ApiDeps, request: Request, key: string): Promise<void> {
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  const results = await Promise.all([
    deps.limiter.limit({ key: `player:${key}` }),
    deps.limiter.limit({ key: `ip:${address}` }),
  ]);
  if (results.some((result) => !result.success)) throw new ApiError("too_many_requests");
}

function playedAt(at: unknown, now: number): number {
  if (typeof at !== "number" || !Number.isFinite(at)) return now;
  return at > now || at < now - STALE_AFTER ? now : Math.round(at);
}

const postScore: Handler = async (request, deps) => {
  const key = await requirePlayerKey(request);
  const body = await readJson(request);
  const { game, mode, score } = body;
  if (
    typeof game !== "string" ||
    typeof mode !== "string" ||
    typeof score !== "number" ||
    !isGameId(game) ||
    !isValidScore(game, mode, score)
  ) {
    throw new ApiError("invalid_request");
  }
  await checkLimit(deps, request, key);
  const now = deps.now();
  const name = typeof body.name === "string" ? normalizeName(body.name) : null;
  await upsertPlayer(deps.db, key, name, now);
  const inserted = await insertScore(deps.db, {
    key,
    game,
    mode,
    score,
    playedAt: playedAt(body.at, now),
    now,
    cooldown: COOLDOWN,
  });
  if (!inserted) throw new ApiError("too_many_requests");

  const best = await playerBest(deps.db, key, game, mode);
  const positions = await playerPositions(
    deps.db,
    PERIODS.map((period) => ({ game, mode, since: periodStart(period, now) })),
    key,
  );
  const ranks = Object.fromEntries(
    PERIODS.map((period, i) => [period, positions[i]]),
  ) as ScoreResponse["ranks"];
  return json({ best, ranks } satisfies ScoreResponse);
};

const getRankings: Handler = async (request, deps) => {
  const params = new URL(request.url).searchParams;
  const game = params.get("game") ?? "";
  const mode = params.get("mode") ?? "";
  const period = params.get("period") ?? "week";
  if (!isGameId(game) || !isValidMode(game, mode) || !isPeriod(period)) {
    throw new ApiError("invalid_request");
  }
  const requested = Number.parseInt(params.get("limit") ?? "", 10);
  const limit = Number.isNaN(requested)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(requested, 1), MAX_LIMIT);
  const key = await playerKey(request);
  const result = await ranking(
    deps.db,
    { game, mode, since: periodStart(period, deps.now()) },
    key,
    limit,
  );
  const me = result.rows.some((row) => row.me) ? null : result.me;
  return json({ rows: result.rows, me: me ?? null, total: result.total } satisfies RankingResponse);
};

const getMe: Handler = async (request, deps) => {
  const key = await requirePlayerKey(request);
  const name = await findPlayerName(deps.db, key);
  if (name === null) throw new ApiError("not_found");
  return json({ name, bests: await playerBests(deps.db, key) } satisfies MeResponse);
};

const putMe: Handler = async (request, deps) => {
  const key = await requirePlayerKey(request);
  const body = await readJson(request);
  if (body.name === null) {
    await checkLimit(deps, request, key);
    return json({ name: await resetPlayerName(deps.db, key, deps.now()) });
  }
  const name = typeof body.name === "string" ? normalizeName(body.name) : null;
  if (name === null) throw new ApiError("invalid_request");
  await checkLimit(deps, request, key);
  return json({ name: await upsertPlayer(deps.db, key, name, deps.now()) });
};

const ROUTES: Record<string, Record<string, Handler>> = {
  "/api/scores": { POST: postScore },
  "/api/rankings": { GET: getRankings },
  "/api/me": { GET: getMe, PUT: putMe },
};

export async function handleApi(request: Request, deps: ApiDeps): Promise<Response> {
  const route = ROUTES[new URL(request.url).pathname];
  if (!route) return errorResponse("not_found");
  const handler = route[request.method];
  if (!handler) return errorResponse("method_not_allowed");
  try {
    return await handler(request, deps);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.code);
    console.error(error);
    return errorResponse("internal");
  }
}
