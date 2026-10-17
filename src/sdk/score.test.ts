import { describe, expect, it } from "vitest";
import { scoreFormat } from "./score.ts";

const time = { label: "時間", format: (score: number) => `${score} ms` };
const area = { label: "開いたマス", format: (score: number) => `${score} マス` };
const game = {
  score: time,
  modes: [
    { id: "easy", label: "初級" },
    { id: "wide", label: "広い", score: area },
  ],
};

describe("scoreFormat", () => {
  it("AC-U18 uses the mode's format when it has one", () => {
    expect(scoreFormat(game, "wide")).toBe(area);
  });

  it("AC-U18 falls back to the game's format", () => {
    expect(scoreFormat(game, "easy")).toBe(time);
    expect(scoreFormat(game, "unknown")).toBe(time);
  });
});
