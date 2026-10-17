import { afterEach, describe, expect, it, vi } from "vitest";
import { getSave, readSave, SAVES_KEY, savesStore, writeSave } from "./saves.ts";

const progress = (opened: string) => ({
  state: { board: [1, 2, 3], opened },
  summary: [{ label: "開いたマス", value: opened }],
});

describe("saves", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-C1 keeps the state and its summary per game and mode", () => {
    writeSave("mines", "infinite", progress("12"), 1_000);
    writeSave("mines", "easy", progress("3"), 2_000);
    expect(readSave("mines", "infinite")).toEqual({ board: [1, 2, 3], opened: "12" });
    expect(getSave(savesStore.get(), "mines", "infinite")).toEqual({
      summary: [{ label: "開いたマス", value: "12" }],
      at: 1_000,
    });
    expect(getSave(savesStore.get(), "mines", "easy")?.at).toBe(2_000);
    expect(getSave(savesStore.get(), "snake", "normal")).toBeNull();
    expect(readSave("snake", "normal")).toBeNull();
    expect(localStorage.getItem(SAVES_KEY)).not.toContain("board");
  });

  it("AC-C2 clears one save with null and leaves the others", () => {
    writeSave("mines", "infinite", progress("12"), 1_000);
    writeSave("mines", "easy", progress("3"), 2_000);
    writeSave("mines", "infinite", null);
    expect(readSave("mines", "infinite")).toBeNull();
    expect(getSave(savesStore.get(), "mines", "infinite")).toBeNull();
    expect(readSave("mines", "easy")).toEqual({ board: [1, 2, 3], opened: "3" });
  });

  it("AC-C3 keeps the previous summary when the state cannot be written", () => {
    writeSave("mines", "infinite", progress("12"), 1_000);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key !== SAVES_KEY) throw new DOMException("full", "QuotaExceededError");
      setItem.call(this, key, value);
    });
    expect(() => writeSave("mines", "infinite", progress("99"), 5_000)).not.toThrow();
    expect(getSave(savesStore.get(), "mines", "infinite")?.at).toBe(1_000);
    expect(readSave("mines", "infinite")).toEqual({ board: [1, 2, 3], opened: "12" });
  });

  it("AC-C4 reads broken or unavailable storage as no save", () => {
    localStorage.setItem(SAVES_KEY, JSON.stringify({ "mines:infinite": { at: "soon" } }));
    localStorage.setItem("kg-games:save:v1:mines:infinite", "{broken");
    expect(getSave(savesStore.get(), "mines", "infinite")).toBeNull();
    expect(readSave("mines", "infinite")).toBeNull();
    localStorage.setItem(SAVES_KEY, "[1]");
    expect(savesStore.get()).toEqual({});

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readSave("mines", "infinite")).toBeNull();
  });
});
