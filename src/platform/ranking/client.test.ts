import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, createApiClient } from "./client.ts";
import { createOutbox } from "./outbox.ts";

const CODE = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("api client", () => {
  it("sends scores with the transfer code as a bearer token", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ best: 9, ranks: {} }),
    );
    const client = createApiClient(fetchImpl);
    await client.submitScore(CODE, { game: "memory", mode: "normal", score: 9, at: 1 });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("/api/scores");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${CODE}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      game: "memory",
      mode: "normal",
      score: 9,
      at: 1,
    });
  });

  it("builds ranking queries and only authenticates when a code is known", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ rows: [], me: null, total: 0 }),
    );
    const client = createApiClient(fetchImpl);
    await client.getRanking({ game: "memory", mode: "normal", period: "week" }, null);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("/api/rankings?game=memory&mode=normal&period=week&limit=10");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it("turns error bodies and network failures into ApiRequestError codes", async () => {
    const limited = createApiClient(async () =>
      jsonResponse({ error: { code: "too_many_requests" } }, 429),
    );
    await expect(limited.getMe(CODE)).rejects.toMatchObject({ code: "too_many_requests" });
    const offline = createApiClient(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(offline.getMe(CODE)).rejects.toBeInstanceOf(ApiRequestError);
    await expect(offline.getMe(CODE)).rejects.toMatchObject({ code: "network" });
    const broken = createApiClient(async () => new Response("<html>", { status: 502 }));
    await expect(broken.getMe(CODE)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("outbox", () => {
  const submission = (score: number) => ({ game: "memory", mode: "normal", score, at: score });

  it("sends queued scores in order and forgets the sent ones", async () => {
    const outbox = createOutbox("test:outbox");
    outbox.add(submission(1));
    outbox.add(submission(2));
    const sent: number[] = [];
    await outbox.flush(async (item) => {
      sent.push(item.score);
    });
    expect(sent).toEqual([1, 2]);
    expect(outbox.pending()).toEqual([]);
  });

  it("keeps scores that can succeed later and stops there", async () => {
    for (const code of ["network", "internal", "too_many_requests"] as const) {
      const outbox = createOutbox(`test:outbox:${code}`);
      outbox.add(submission(1));
      outbox.add(submission(2));
      const send = vi.fn(async () => {
        throw new ApiRequestError(code);
      });
      await outbox.flush(send);
      expect(send).toHaveBeenCalledTimes(1);
      expect(outbox.pending().map((item) => item.score)).toEqual([1, 2]);
    }
  });

  it("drops scores the server will never accept and continues", async () => {
    const outbox = createOutbox("test:outbox:drop");
    outbox.add(submission(1));
    outbox.add(submission(2));
    const sent: number[] = [];
    await outbox.flush(async (item) => {
      if (item.score === 1) throw new ApiRequestError("invalid_request");
      sent.push(item.score);
    });
    expect(sent).toEqual([2]);
    expect(outbox.pending()).toEqual([]);
  });

  it("does not run two flushes at once", async () => {
    const outbox = createOutbox("test:outbox:once");
    outbox.add(submission(1));
    let calls = 0;
    const send = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
    };
    await Promise.all([outbox.flush(send), outbox.flush(send)]);
    expect(calls).toBe(1);
  });
});
