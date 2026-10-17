import { describe, expect, it } from "vitest";
import { CODE_LENGTH, formatCode, generateCode, normalizeCode } from "./code.ts";

const CROCKFORD = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]+$/;

describe("transfer code", () => {
  it("AC-S4 generates 32 Crockford base32 characters", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(codes.size).toBe(50);
    for (const code of codes) {
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).toMatch(CROCKFORD);
    }
  });

  it("AC-S4 encodes every bit of the random bytes", () => {
    expect(generateCode((bytes) => bytes.fill(0))).toBe("0".repeat(32));
    expect(generateCode((bytes) => bytes.fill(255))).toBe("Z".repeat(32));
  });

  it("AC-S5 accepts full-width, lowercase, spaces, and hyphens", () => {
    const code = generateCode();
    const messy = ` ${formatCode(code).toLowerCase()} `.replace(/-/g, " - ");
    expect(normalizeCode(messy)).toBe(code);
    const fullWidth = code.replace(/[0-9A-Z]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0xfee0),
    );
    expect(normalizeCode(fullWidth)).toBe(code);
  });

  it("AC-S5 reads I and L as 1 and O as 0", () => {
    const code = `1${"0".repeat(30)}1`;
    expect(normalizeCode(`I${"O".repeat(30)}l`)).toBe(code);
  });

  it("AC-S5 returns null unless 32 valid characters remain", () => {
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode("ABC")).toBeNull();
    expect(normalizeCode(`${"0".repeat(31)}U`)).toBeNull();
    expect(normalizeCode("0".repeat(33))).toBeNull();
  });

  it("AC-S6 groups four characters with hyphens", () => {
    expect(formatCode("0123456789ABCDEFGHJKMNPQRSTVWXYZ")).toBe(
      "0123-4567-89AB-CDEF-GHJK-MNPQ-RSTV-WXYZ",
    );
  });
});
