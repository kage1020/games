import { describe, expect, it } from "vitest";
import { NAME_MAX, normalizeName } from "./name.ts";

describe("normalizeName", () => {
  it("AC-S7 applies NFKC and strips control and format characters", () => {
    expect(normalizeName("ｋａｇｅ")).toBe("kage");
    expect(normalizeName("ｶﾞﾒ")).toBe("ガメ");
    expect(normalizeName("a\u0000b​c‮d")).toBe("abcd");
  });

  it("AC-S7 collapses whitespace and trims", () => {
    expect(normalizeName("  Mina \t\n Aoki  ")).toBe("Mina Aoki");
    expect(normalizeName("Mina　Aoki")).toBe("Mina Aoki");
  });

  it("AC-S8 cuts after 16 code points", () => {
    expect(NAME_MAX).toBe(16);
    expect(normalizeName("あ".repeat(20))).toBe("あ".repeat(16));
    expect(normalizeName("😀".repeat(17))).toBe("😀".repeat(16));
  });

  it("AC-S8 returns null for an empty result", () => {
    expect(normalizeName("")).toBeNull();
    expect(normalizeName(" ​ \t")).toBeNull();
  });
});
