import { generateCode } from "@shared/code.ts";
import { beforeEach, describe, expect, it } from "vitest";
import { type ApiDeps, handleApi } from "./api.ts";
import { createSqliteDb } from "./testing/sqlite-db.ts";

const NOW = Date.parse("2026-10-17T12:00:00+09:00");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface CallOptions {
  code?: string;
  body?: unknown;
  rawBody?: string;
  ip?: string;
}

function setup() {
  let now = NOW;
  let allowWrites = true;
  const blockedKeys = new Set<string>();
  const deps: ApiDeps = {
    db: createSqliteDb(),
    limiter: { limit: async ({ key }) => ({ success: allowWrites && !blockedKeys.has(key) }) },
    now: () => now,
  };
  const call = async (method: string, path: string, options: CallOptions = {}) => {
    const headers = new Headers();
    if (options.code) headers.set("authorization", `Bearer ${options.code}`);
    if (options.ip) headers.set("cf-connecting-ip", options.ip);
    const body =
      options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
    if (body !== undefined) headers.set("content-type", "application/json");
    const response = await handleApi(
      new Request(`https://game.kage1020.com${path}`, { method, headers, body }),
      deps,
    );
    return { status: response.status, json: (await response.json()) as Record<string, unknown> };
  };
  const submit = (code: string, score: number, extra: Record<string, unknown> = {}) => {
    const result = call("POST", "/api/scores", {
      code,
      body: { game: "memory", mode: "normal", score, ...extra },
    });
    now += 2_500;
    return result;
  };
  return {
    call,
    submit,
    advance: (ms: number) => {
      now += ms;
    },
    setNow: (value: number) => {
      now = value;
    },
    blockWrites: () => {
      allowWrites = false;
    },
    blockKey: (key: string) => {
      blockedKeys.add(key);
    },
    deps,
  };
}

type App = ReturnType<typeof setup>;

describe("POST /api/scores", () => {
  let app: App;
  beforeEach(() => {
    app = setup();
  });

  it("AC-W1 requires a valid transfer code", async () => {
    const body = { game: "memory", mode: "normal", score: 5 };
    expect((await app.call("POST", "/api/scores", { body })).status).toBe(401);
    expect((await app.call("POST", "/api/scores", { body, code: "short" })).status).toBe(401);
  });

  it("AC-W1 rejects unknown games, modes, and out-of-range scores", async () => {
    const code = generateCode();
    const bad = [
      { game: "chess", mode: "normal", score: 1 },
      { game: "memory", mode: "hard", score: 1 },
      { game: "memory", mode: "normal", score: 41 },
      { game: "memory", mode: "normal", score: "5" },
      { game: "memory", mode: "normal" },
    ];
    for (const body of bad) {
      const response = await app.call("POST", "/api/scores", { code, body });
      expect(response.status).toBe(400);
      expect(response.json).toEqual({ error: { code: "invalid_request" } });
    }
    expect((await app.call("POST", "/api/scores", { code, rawBody: "{" })).status).toBe(400);
  });

  it("AC-W2 creates the player on the first score with a guest name", async () => {
    const code = generateCode();
    expect((await app.submit(code, 5)).status).toBe(200);
    const me = await app.call("GET", "/api/me", { code });
    expect(me.json.name).toMatch(/^guest-[0-9a-f]{4}$/);
  });

  it("AC-W2 uses the given name, normalized", async () => {
    const code = generateCode();
    await app.submit(code, 5, { name: "  ｍｉｎａ  " });
    expect((await app.call("GET", "/api/me", { code })).json.name).toBe("mina");
  });

  it("AC-W3 returns the player's best and ranks for each period", async () => {
    const [a, b, c] = [generateCode(), generateCode(), generateCode()];
    await app.submit(a, 9);
    await app.submit(b, 12);
    await app.submit(c, 7);
    const response = await app.submit(a, 8);
    expect(response.status).toBe(200);
    expect(response.json).toEqual({
      best: 9,
      ranks: {
        today: { rank: 2, total: 3 },
        week: { rank: 2, total: 3 },
        all: { rank: 2, total: 3 },
      },
    });
  });

  it("AC-W7 replaces a future or stale played-at time with the server time", async () => {
    const code = generateCode();
    await app.submit(code, 9, { at: NOW + DAY });
    await app.submit(generateCode(), 3, { at: NOW - 8 * DAY });
    const today = await app.call("GET", "/api/rankings?game=memory&mode=normal&period=today");
    expect(today.json.total).toBe(2);
    await app.submit(generateCode(), 4, { at: NOW - 2 * DAY });
    const todayAgain = await app.call("GET", "/api/rankings?game=memory&mode=normal&period=today");
    expect(todayAgain.json.total).toBe(2);
  });

  it("AC-W8 refuses a second score for the same game within two seconds", async () => {
    const code = generateCode();
    const body = { game: "memory", mode: "normal", score: 5 };
    expect((await app.call("POST", "/api/scores", { code, body })).status).toBe(200);
    app.advance(1_000);
    const again = await app.call("POST", "/api/scores", { code, body });
    expect(again.status).toBe(429);
    expect(again.json).toEqual({ error: { code: "too_many_requests" } });
    const other = await app.call("POST", "/api/scores", {
      code,
      body: { game: "snake", mode: "normal", score: 5 },
    });
    expect(other.status).toBe(200);
    app.advance(1_500);
    expect((await app.call("POST", "/api/scores", { code, body })).status).toBe(200);
  });

  it("AC-W8 refuses writes over the rate limit", async () => {
    app.blockWrites();
    expect((await app.submit(generateCode(), 5)).status).toBe(429);
  });

  it("AC-W8 limits writes by client address so fresh codes do not escape the limit", async () => {
    app.blockKey("ip:203.0.113.7");
    const body = { game: "memory", mode: "normal", score: 5 };
    const blocked = await app.call("POST", "/api/scores", {
      code: generateCode(),
      body,
      ip: "203.0.113.7",
    });
    expect(blocked.status).toBe(429);
    const other = await app.call("POST", "/api/scores", {
      code: generateCode(),
      body,
      ip: "203.0.113.8",
    });
    expect(other.status).toBe(200);
  });

  it("AC-W8 keeps the cooldown when two scores race", async () => {
    const code = generateCode();
    const body = { game: "memory", mode: "normal", score: 5 };
    const responses = await Promise.all([
      app.call("POST", "/api/scores", { code, body }),
      app.call("POST", "/api/scores", { code, body }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 429]);
    const me = await app.call("GET", "/api/me", { code });
    expect(me.json.bests).toEqual([{ game: "memory", mode: "normal", best: 5, plays: 1 }]);
  });
});

describe("GET /api/rankings", () => {
  let app: App;
  beforeEach(() => {
    app = setup();
  });

  it("AC-W4 ranks each player's best, sharing ranks on ties", async () => {
    const players = [generateCode(), generateCode(), generateCode(), generateCode()];
    const scores = [10, 8, 8, 5];
    for (const [i, code] of players.entries()) await app.submit(code, scores[i] ?? 0);
    await app.submit(players[3] as string, 3);
    const response = await app.call("GET", "/api/rankings?game=memory&mode=normal&period=all");
    const rows = response.json.rows as { rank: number; score: number }[];
    expect(rows.map((r) => [r.rank, r.score])).toEqual([
      [1, 10],
      [2, 8],
      [2, 8],
      [4, 5],
    ]);
    expect(response.json.total).toBe(4);
  });

  it("AC-W4 puts smaller scores first for ascending games", async () => {
    for (const score of [250, 180, 320]) {
      await app.call("POST", "/api/scores", {
        code: generateCode(),
        body: { game: "reaction", mode: "normal", score },
      });
    }
    const response = await app.call("GET", "/api/rankings?game=reaction&mode=normal&period=all");
    const rows = response.json.rows as { rank: number; score: number }[];
    expect(rows.map((r) => r.score)).toEqual([180, 250, 320]);
  });

  it("AC-W5 limits rows and marks the caller", async () => {
    const me = generateCode();
    for (let i = 0; i < 12; i++) await app.submit(generateCode(), 10 + 2 * i);
    await app.submit(me, 13);
    const top = await app.call("GET", "/api/rankings?game=memory&mode=normal&period=all", {
      code: me,
    });
    const rows = top.json.rows as { me: boolean }[];
    expect(rows).toHaveLength(10);
    expect(rows.some((r) => r.me)).toBe(false);
    expect(top.json.me).toMatchObject({ rank: 11, score: 13 });

    const wide = await app.call(
      "GET",
      "/api/rankings?game=memory&mode=normal&period=all&limit=50",
      { code: me },
    );
    const wideRows = wide.json.rows as { me: boolean; rank: number }[];
    expect(wideRows).toHaveLength(13);
    expect(wideRows.find((r) => r.me)?.rank).toBe(11);

    const capped = await app.call("GET", "/api/rankings?game=memory&mode=normal&limit=999");
    expect(capped.status).toBe(200);
  });

  it("AC-W5 returns me as null when the caller has no score", async () => {
    await app.submit(generateCode(), 5);
    const response = await app.call("GET", "/api/rankings?game=memory&mode=normal&period=all", {
      code: generateCode(),
    });
    expect(response.json.me).toBeNull();
  });

  it("AC-W6 ignores scores outside the period", async () => {
    const old = generateCode();
    app.setNow(NOW - 3 * DAY);
    await app.submit(old, 30);
    app.setNow(NOW);
    await app.submit(generateCode(), 5);
    const today = await app.call("GET", "/api/rankings?game=memory&mode=normal&period=today");
    expect((today.json.rows as { score: number }[]).map((r) => r.score)).toEqual([5]);
    const week = await app.call("GET", "/api/rankings?game=memory&mode=normal&period=week");
    expect(week.json.total).toBe(2);
  });

  it("AC-W1 rejects unknown games, modes, and periods", async () => {
    for (const query of [
      "game=chess&mode=normal",
      "game=memory&mode=hard",
      "game=memory&mode=normal&period=month",
      "mode=normal",
    ]) {
      expect((await app.call("GET", `/api/rankings?${query}`)).status).toBe(400);
    }
  });
});

describe("/api/me", () => {
  let app: App;
  beforeEach(() => {
    app = setup();
  });

  it("AC-W9 returns the name and each best with play counts", async () => {
    const code = generateCode();
    await app.submit(code, 5);
    await app.submit(code, 9);
    await app.call("POST", "/api/scores", {
      code,
      body: { game: "reaction", mode: "normal", score: 240 },
    });
    app.advance(2_500);
    await app.call("POST", "/api/scores", {
      code,
      body: { game: "reaction", mode: "normal", score: 210 },
    });
    const me = await app.call("GET", "/api/me", { code });
    expect(me.status).toBe(200);
    expect(me.json.bests).toEqual(
      expect.arrayContaining([
        { game: "memory", mode: "normal", best: 9, plays: 2 },
        { game: "reaction", mode: "normal", best: 210, plays: 2 },
      ]),
    );
  });

  it("AC-W9 answers 404 for an unknown code", async () => {
    const response = await app.call("GET", "/api/me", { code: generateCode() });
    expect(response.status).toBe(404);
    expect(response.json).toEqual({ error: { code: "not_found" } });
  });

  it("AC-W10 saves a normalized name", async () => {
    const code = generateCode();
    const response = await app.call("PUT", "/api/me", { code, body: { name: "  Mina​ Aoki " } });
    expect(response.status).toBe(200);
    expect(response.json).toEqual({ name: "Mina Aoki" });
    expect((await app.call("GET", "/api/me", { code })).json.name).toBe("Mina Aoki");
  });

  it("AC-W10 resets to the default name with null", async () => {
    const code = generateCode();
    await app.call("PUT", "/api/me", { code, body: { name: "Mina" } });
    const reset = await app.call("PUT", "/api/me", { code, body: { name: null } });
    expect(reset.status).toBe(200);
    expect(reset.json.name).toMatch(/^guest-[0-9a-f]{4}$/);
    expect((await app.call("GET", "/api/me", { code })).json.name).toBe(reset.json.name);
  });

  it("AC-W10 rejects an empty name", async () => {
    const response = await app.call("PUT", "/api/me", {
      code: generateCode(),
      body: { name: " " },
    });
    expect(response.status).toBe(400);
  });
});

describe("routing", () => {
  it("AC-W11 answers unknown paths with 404 and wrong methods with 405 as JSON", async () => {
    const app = setup();
    const missing = await app.call("GET", "/api/nothing");
    expect(missing.status).toBe(404);
    expect(missing.json).toEqual({ error: { code: "not_found" } });
    const wrong = await app.call("DELETE", "/api/scores");
    expect(wrong.status).toBe(405);
    expect(wrong.json).toEqual({ error: { code: "method_not_allowed" } });
  });
});
