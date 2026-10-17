import { describe, expect, it } from "vitest";
import { periodStart } from "./period.ts";

const at = (iso: string) => Date.parse(iso);

describe("periodStart", () => {
  it("AC-S9 today starts at midnight in Japan", () => {
    expect(periodStart("today", at("2026-10-17T00:30:00+09:00"))).toBe(
      at("2026-10-17T00:00:00+09:00"),
    );
    expect(periodStart("today", at("2026-10-16T23:59:59+09:00"))).toBe(
      at("2026-10-16T00:00:00+09:00"),
    );
    expect(periodStart("today", at("2026-10-16T15:00:00Z"))).toBe(at("2026-10-17T00:00:00+09:00"));
  });

  it("AC-S10 the week starts on Monday at midnight in Japan", () => {
    const monday = at("2026-10-12T00:00:00+09:00");
    expect(periodStart("week", at("2026-10-17T12:00:00+09:00"))).toBe(monday);
    expect(periodStart("week", at("2026-10-18T23:59:59+09:00"))).toBe(monday);
    expect(periodStart("week", monday)).toBe(monday);
    expect(periodStart("week", monday - 1)).toBe(at("2026-10-05T00:00:00+09:00"));
  });

  it("AC-S11 all starts at zero", () => {
    expect(periodStart("all", Date.now())).toBe(0);
  });
});
