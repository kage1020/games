import { describe, expect, it } from "vitest";
import { createSession, describeResult, type SessionState, sessionReducer } from "./session.ts";

const timed = createSession(true);
const untimed = createSession(false);
const result = { score: 12 };

function run(state: SessionState, ...actions: Parameters<typeof sessionReducer>[1][]) {
  return actions.reduce(sessionReducer, state);
}

describe("sessionReducer", () => {
  it("AC-P1 starts ready and moves to playing with a new run", () => {
    expect(timed).toMatchObject({ status: "ready", run: 0, result: null });
    expect(run(timed, { type: "start" })).toMatchObject({ status: "playing", run: 1 });
  });

  it("AC-P2 pauses only timed games while playing", () => {
    const playing = run(timed, { type: "start" });
    expect(run(playing, { type: "pause" }).status).toBe("paused");
    expect(run(playing, { type: "pause" }, { type: "resume" }).status).toBe("playing");
    expect(run(untimed, { type: "start" }, { type: "pause" }).status).toBe("playing");
    expect(run(timed, { type: "pause" }).status).toBe("ready");
  });

  it("AC-P3 finishes with the result and ignores pause afterwards", () => {
    const finished = run(timed, { type: "start" }, { type: "finish", result });
    expect(finished).toMatchObject({ status: "finished", result });
    expect(run(finished, { type: "pause" })).toBe(finished);
  });

  it("AC-P4 restarts from any state into a new run", () => {
    for (const state of [
      timed,
      run(timed, { type: "start" }),
      run(timed, { type: "start" }, { type: "pause" }),
      run(timed, { type: "start" }, { type: "finish", result }),
    ]) {
      const restarted = run(state, { type: "restart" });
      expect(restarted).toMatchObject({ status: "playing", run: state.run + 1, result: null });
    }
  });

  it("resets to ready when the mode changes", () => {
    const reset = run(timed, { type: "start" }, { type: "reset" });
    expect(reset).toMatchObject({ status: "ready", result: null });
  });
});

describe("describeResult", () => {
  const format = (n: number) => `${n} 点`;
  const outcome = { isFirst: false, isBest: false, isTie: false, previousBest: 10 };

  it("AC-P5 greets a first record", () => {
    expect(
      describeResult(5, { ...outcome, isFirst: true, isBest: true, previousBest: null }, format),
    ).toEqual({
      note: "はじめての記録。",
      celebrate: false,
    });
  });

  it("AC-P5 celebrates a new personal best", () => {
    expect(describeResult(12, { ...outcome, isBest: true }, format)).toEqual({
      note: "自己ベストを更新した。",
      celebrate: true,
    });
  });

  it("AC-P5 notes a tie and otherwise the best to beat", () => {
    expect(describeResult(10, { ...outcome, isTie: true }, format).note).toBe(
      "自己ベストに並んだ。",
    );
    expect(describeResult(8, outcome, format)).toEqual({
      note: "自己ベストは 10 点。",
      celebrate: false,
    });
  });

  it("AC-P5 explains an unscored end", () => {
    expect(describeResult(null, outcome, format, "地雷を踏んだ。")).toEqual({
      note: "地雷を踏んだ。",
      celebrate: false,
    });
    expect(describeResult(null, outcome, format).note).toBe("記録は残らない。");
  });
});
