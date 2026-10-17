import { afterEach, describe, expect, it, vi } from "vitest";
import { createSound } from "./sound.ts";

describe("createSound", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-G-mines-13 vibrates briefly for a flag on devices that can", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const sound = createSound(() => 0.6);
    sound.play("flag");
    expect(vibrate).toHaveBeenCalledTimes(1);
    sound.play("tap");
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("AC-G-mines-13 stays still when muted", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    createSound(() => 0).play("flag");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("AC-G-mines-13 plays without vibration where the device cannot vibrate", () => {
    vi.stubGlobal("navigator", {});
    expect(() => createSound(() => 0.6).play("flag")).not.toThrow();
  });
});
