import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, selectedMode } from "./settings.ts";

const mines = {
  id: "mines" as const,
  modes: [
    { id: "easy", label: "初級" },
    { id: "normal", label: "中級" },
  ],
};

describe("selectedMode", () => {
  it("AC-U17 uses the saved mode when the game has it", () => {
    expect(selectedMode({ ...DEFAULT_SETTINGS, modes: { mines: "normal" } }, mines)).toBe("normal");
  });

  it("AC-U17 falls back to the first mode when nothing is saved or the saved mode is gone", () => {
    expect(selectedMode(DEFAULT_SETTINGS, mines)).toBe("easy");
    expect(selectedMode({ ...DEFAULT_SETTINGS, modes: { mines: "expert" } }, mines)).toBe("easy");
  });
});
