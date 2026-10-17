import { describe, expect, it } from "vitest";
import { createRng } from "@/sdk/rng.ts";
import {
  averageTime,
  createReaction,
  MAX_DELAY,
  MIN_DELAY,
  next,
  press,
  type ReactionState,
  ROUNDS,
  resume,
  signal,
  signalDueAt,
} from "./logic.ts";

/** 待ちから合図までを進め、合図から reaction ミリ秒後に押す */
function playRound(state: ReactionState, reaction: number): ReactionState {
  const shown = signal(state, signalDueAt(state));
  return press(shown, signalDueAt(state) + reaction);
}

describe("reaction", () => {
  it("AC-G-reaction-1 waits 1.5 to 4 seconds before each signal", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = createRng(seed);
      let state = createReaction(rng, 1_000);
      for (let round = 0; round < ROUNDS; round++) {
        expect(state.phase).toBe("waiting");
        expect(state.delay).toBeGreaterThanOrEqual(MIN_DELAY);
        expect(state.delay).toBeLessThan(MAX_DELAY);
        expect(signalDueAt(state)).toBe(state.waitStartedAt + state.delay);
        state = playRound(state, 200);
        state = next(state, rng, signalDueAt(state) + 1_400);
      }
    }
    expect(MIN_DELAY).toBe(1_500);
    expect(MAX_DELAY).toBe(4_000);
  });

  it("AC-G-reaction-1 shows the signal only while waiting", () => {
    const rng = createRng(2);
    const waiting = createReaction(rng, 0);
    const shown = signal(waiting, 2_000);
    expect(shown).toMatchObject({ phase: "signal", signalAt: 2_000 });
    expect(signal(shown, 2_500)).toBe(shown);
    const result = press(shown, 2_250);
    expect(signal(result, 3_000)).toBe(result);
  });

  it("AC-G-reaction-1 is decided by the seed", () => {
    expect(createReaction(createRng(9), 0).delay).toBe(createReaction(createRng(9), 0).delay);
  });

  it("AC-G-reaction-2 marks a press before the signal as too early and retries the round", () => {
    const rng = createRng(3);
    const waiting = createReaction(rng, 0);
    const early = press(waiting, 500);
    expect(early).toMatchObject({ phase: "early", times: [] });
    const retry = next(early, rng, 1_700);
    expect(retry).toMatchObject({
      phase: "waiting",
      times: [],
      waitStartedAt: 1_700,
      signalAt: null,
    });
    expect(retry.delay).toBeGreaterThanOrEqual(MIN_DELAY);
  });

  it("AC-G-reaction-3 records the milliseconds from the signal to the press", () => {
    const rng = createRng(4);
    const shown = signal(createReaction(rng, 0), 2_000);
    const result = press(shown, 2_243.6);
    expect(result).toMatchObject({ phase: "result", times: [244], last: 244 });
    expect(press(result, 2_400)).toBe(result);
    const nextRound = next(result, rng, 3_500);
    expect(nextRound).toMatchObject({ phase: "waiting", times: [244], signalAt: null });
  });

  it("AC-G-reaction-4 ends after five rounds with the rounded average", () => {
    const rng = createRng(5);
    let state = createReaction(rng, 0);
    const reactions = [200, 251, 230, 199, 241];
    for (const [i, reaction] of reactions.entries()) {
      state = playRound(state, reaction);
      if (i < reactions.length - 1) {
        expect(state.phase).toBe("result");
        state = next(state, rng, signalDueAt(state) + 2_000);
      }
    }
    expect(state.phase).toBe("over");
    expect(state.times).toEqual(reactions);
    expect(averageTime(state)).toBe(224);
    expect(next(state, rng, 99_999)).toBe(state);
  });

  it("AC-G-reaction-5 restarts the round from waiting after a pause", () => {
    const rng = createRng(6);
    const waiting = createReaction(rng, 0);
    const resumedWaiting = resume(waiting, rng, 10_000);
    expect(resumedWaiting).toMatchObject({ phase: "waiting", waitStartedAt: 10_000, times: [] });

    const shown = signal(waiting, signalDueAt(waiting));
    const resumedSignal = resume(shown, rng, 20_000);
    expect(resumedSignal).toMatchObject({
      phase: "waiting",
      signalAt: null,
      waitStartedAt: 20_000,
    });

    const early = press(waiting, 100);
    expect(resume(early, rng, 30_000)).toMatchObject({ phase: "waiting", times: [] });

    const result = press(shown, signalDueAt(waiting) + 210);
    expect(resume(result, rng, 40_000)).toMatchObject({
      phase: "waiting",
      times: [210],
      waitStartedAt: 40_000,
    });
  });
});
