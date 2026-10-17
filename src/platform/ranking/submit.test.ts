import type { ScoreResponse } from "@shared/api.ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ApiClient, ApiRequestError } from "./client.ts";
import { outbox } from "./outbox.ts";
import { submitScore } from "./submit.ts";

const RESPONSE: ScoreResponse = {
  best: 1,
  ranks: {
    today: { rank: 1, total: 1 },
    week: { rank: 1, total: 1 },
    all: { rank: 1, total: 1 },
  },
};

function fakeApi() {
  const submit = vi.fn<ApiClient["submitScore"]>(async () => RESPONSE);
  const api: ApiClient = {
    submitScore: submit,
    getRanking: vi.fn(),
    getMe: vi.fn(),
    putName: vi.fn(),
  };
  return { api, submit };
}

describe("submitScore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-O5 sends what is waiting only after the per-game interval has passed", async () => {
    vi.useFakeTimers();
    outbox.add({ game: "memory", mode: "normal", score: 3, at: 1 });
    const { api, submit } = fakeApi();
    await submitScore(api, { game: "memory", mode: "normal", score: 5, at: 2 });
    expect(submit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_900);
    expect(submit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]?.[1]).toMatchObject({ score: 3 });
    expect(outbox.pending()).toEqual([]);
  });

  it("queues a score that fails to send", async () => {
    const { api, submit } = fakeApi();
    submit.mockRejectedValueOnce(new ApiRequestError("network"));
    expect(await submitScore(api, { game: "snake", mode: "normal", score: 4, at: 3 })).toBeNull();
    expect(outbox.pending()).toEqual([{ game: "snake", mode: "normal", score: 4, at: 3 }]);
  });
});
