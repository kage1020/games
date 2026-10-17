import { describe, expect, it } from "vitest";
import { formatDuration, formatNumber, formatPlayedAt, nameLengthHint } from "./format.ts";

describe("format", () => {
  it("AC-F1 groups thousands", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(12480)).toBe("12,480");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("AC-F2 formats milliseconds as m:ss.s", () => {
    expect(formatDuration(0)).toBe("0:00.0");
    expect(formatDuration(62_300)).toBe("1:02.3");
    expect(formatDuration(9_960)).toBe("0:10.0");
    expect(formatDuration(3_725_000)).toBe("62:05.0");
  });

  it("AC-F3 picks relative or absolute dates", () => {
    const now = new Date(2026, 9, 17, 12, 0).getTime();
    expect(formatPlayedAt(new Date(2026, 9, 17, 2, 7).getTime(), now)).toBe("02:07");
    expect(formatPlayedAt(new Date(2026, 9, 16, 23, 59).getTime(), now)).toBe("昨日");
    expect(formatPlayedAt(new Date(2026, 9, 8, 9, 0).getTime(), now)).toBe("10月8日");
    expect(formatPlayedAt(new Date(2025, 9, 10, 9, 0).getTime(), now)).toBe("2025/10/10");
    expect(
      formatPlayedAt(new Date(2026, 0, 1, 0, 0).getTime(), new Date(2026, 0, 2, 9).getTime()),
    ).toBe("昨日");
  });

  it("AC-F4 tells how many characters remain or are over", () => {
    expect(nameLengthHint("")).toBe("あと 16 字");
    expect(nameLengthHint("あ".repeat(16))).toBe("あと 0 字");
    expect(nameLengthHint("あ".repeat(20))).toBe("4 字多い");
    expect(nameLengthHint("  ｍｉｎａ  ")).toBe("あと 12 字");
  });
});
