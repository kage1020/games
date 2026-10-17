import { describe, expect, it } from "vitest";
import {
  getModeRecord,
  loadRecords,
  mergeServerBests,
  type Records,
  recordPlay,
  saveRecords,
} from "./records.ts";

const play = (
  records: Records,
  score: number | null,
  extra: Partial<{ game: string; mode: string; order: "asc" | "desc"; at: number }> = {},
) =>
  recordPlay(records, {
    game: extra.game ?? "memory",
    mode: extra.mode ?? "normal",
    order: extra.order ?? "desc",
    score,
    at: extra.at ?? 1_000,
  });

describe("recordPlay", () => {
  it("AC-R1 marks the first score as first and best", () => {
    const outcome = play({}, 7);
    expect(outcome).toMatchObject({
      isFirst: true,
      isBest: true,
      isTie: false,
      previousBest: null,
    });
    expect(getModeRecord(outcome.records, "memory", "normal").best).toBe(7);
  });

  it("AC-R2 reports a better score with the previous best", () => {
    const first = play({}, 7).records;
    expect(play(first, 9)).toMatchObject({ isFirst: false, isBest: true, previousBest: 7 });
    expect(play(first, 5)).toMatchObject({ isBest: false, isTie: false, previousBest: 7 });
    expect(play(first, 7)).toMatchObject({ isBest: false, isTie: true, previousBest: 7 });
    expect(getModeRecord(play(first, 5).records, "memory", "normal").best).toBe(7);
  });

  it("AC-R2 treats lower as better for ascending games", () => {
    const first = play({}, 300, { game: "reaction", order: "asc" }).records;
    expect(play(first, 250, { game: "reaction", order: "asc" }).isBest).toBe(true);
    expect(play(first, 350, { game: "reaction", order: "asc" }).isBest).toBe(false);
  });

  it("AC-R3 counts plays and keeps the ten latest scores, newest first", () => {
    let records: Records = {};
    for (let i = 1; i <= 12; i++) records = play(records, i, { at: i * 1_000 }).records;
    const mode = getModeRecord(records, "memory", "normal");
    expect(mode.plays).toBe(12);
    expect(mode.recent).toHaveLength(10);
    expect(mode.recent[0]).toEqual({ score: 12, at: 12_000 });
    expect(mode.recent.at(-1)).toEqual({ score: 3, at: 3_000 });
  });

  it("AC-R4 counts an unscored play without touching the best or the list", () => {
    const first = play({}, 7).records;
    const outcome = play(first, null);
    const mode = getModeRecord(outcome.records, "memory", "normal");
    expect(mode).toEqual({ best: 7, plays: 2, recent: [{ score: 7, at: 1_000 }] });
    expect(outcome).toMatchObject({ isFirst: false, isBest: false, isTie: false });
  });

  it("AC-R5 keeps games and modes apart", () => {
    let records = play({}, 7).records;
    records = play(records, 30, { game: "territory", mode: "p2" }).records;
    records = play(records, 12, { game: "territory", mode: "p4" }).records;
    expect(getModeRecord(records, "memory", "normal").best).toBe(7);
    expect(getModeRecord(records, "territory", "p2").best).toBe(30);
    expect(getModeRecord(records, "territory", "p4").best).toBe(12);
    expect(getModeRecord(records, "territory", "p3")).toEqual({ best: null, plays: 0, recent: [] });
  });
});

describe("mergeServerBests", () => {
  it("AC-R6 keeps the better best and the larger play count", () => {
    let records = play({}, 7).records;
    records = play(records, 300, { game: "reaction", order: "asc" }).records;
    const merged = mergeServerBests(
      records,
      [
        { game: "memory", mode: "normal", best: 5, plays: 4 },
        { game: "reaction", mode: "normal", best: 240, plays: 1 },
        { game: "snake", mode: "normal", best: 12, plays: 3 },
        { game: "unknown", mode: "normal", best: 1, plays: 1 },
      ],
      (game) => (game === "reaction" ? "asc" : game === "unknown" ? null : "desc"),
    );
    expect(getModeRecord(merged, "memory", "normal")).toMatchObject({ best: 7, plays: 4 });
    expect(getModeRecord(merged, "reaction", "normal")).toMatchObject({ best: 240, plays: 1 });
    expect(getModeRecord(merged, "snake", "normal")).toMatchObject({ best: 12, plays: 3 });
    expect(merged.unknown).toBeUndefined();
  });

  it("AC-R6 compares each mode by its own order", () => {
    let records = play({}, 30_000, { game: "mines", mode: "easy", order: "asc" }).records;
    records = play(records, 150, { game: "mines", mode: "wide", order: "desc" }).records;
    const merged = mergeServerBests(
      records,
      [
        { game: "mines", mode: "easy", best: 20_000, plays: 1 },
        { game: "mines", mode: "wide", best: 120, plays: 1 },
      ],
      (_game, mode) => (mode === "wide" ? "desc" : "asc"),
    );
    expect(getModeRecord(merged, "mines", "easy").best).toBe(20_000);
    expect(getModeRecord(merged, "mines", "wide").best).toBe(150);
  });
});

describe("storage", () => {
  it("AC-R7 round-trips through storage", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    const records = play({}, 7).records;
    saveRecords(storage, records);
    expect(loadRecords(storage)).toEqual(records);
  });

  it("AC-R7 falls back to empty records on broken or unavailable storage", () => {
    expect(loadRecords({ getItem: () => "{not json", setItem: () => {} })).toEqual({});
    expect(
      loadRecords({ getItem: () => '{"memory":{"normal":{"best":"x"}}}', setItem: () => {} }),
    ).toEqual({});
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadRecords(throwing)).toEqual({});
    expect(() => saveRecords(throwing, {})).not.toThrow();
  });
});
