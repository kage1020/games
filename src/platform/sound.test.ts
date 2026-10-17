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

describe("createSound loudness", () => {
  /** 鳴らした音の音量の動きと、つないだ先を記録する AudioContext の代わり */
  function fakeAudio() {
    const ramps: { kind: string; value: number; at: number }[] = [];
    const connections: string[] = [];
    let shapers = 0;
    let shaper: { curve: Float32Array | null } | null = null;
    class FakeContext {
      currentTime = 10;
      state = "running";
      destination = { name: "destination" };
      createWaveShaper() {
        shapers++;
        const node = {
          name: "shaper",
          curve: null as Float32Array | null,
          connect: (to: { name: string }) => connections.push(`shaper>${to.name}`),
        };
        shaper = node;
        return node;
      }
      createGain() {
        const record = (kind: string) => (value: number, at: number) =>
          ramps.push({ kind, value, at });
        return {
          name: "gain",
          gain: {
            setValueAtTime: record("set"),
            linearRampToValueAtTime: record("linear"),
            exponentialRampToValueAtTime: record("exponential"),
          },
          connect: (to: { name: string }) => connections.push(`gain>${to.name}`),
        };
      }
      createOscillator() {
        return {
          type: "sine",
          frequency: { value: 0 },
          connect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
        };
      }
      resume() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("AudioContext", FakeContext);
    return { ramps, connections, shapers: () => shapers, curve: () => shaper?.curve ?? null };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("AC-U19 peaks at 0.4 at full volume and scales with the setting", async () => {
    const audio = fakeAudio();
    const { createSound: create } = await import("./sound.ts");
    create(() => 1).play("tap");
    create(() => 0.5).play("tap");
    const peaks = audio.ramps.filter((ramp) => ramp.kind === "linear").map((ramp) => ramp.value);
    expect(peaks).toEqual([0.4, 0.2]);
  });

  it("AC-U19 rises over 5ms and sends every sound through one soft clipper", async () => {
    const audio = fakeAudio();
    const { createSound: create } = await import("./sound.ts");
    const sound = create(() => 1);
    sound.play("clear");
    sound.play("tap");
    const [set, rise] = audio.ramps;
    expect(set).toMatchObject({ kind: "set", at: 10 });
    expect(rise?.at).toBeCloseTo(10.005);
    expect(audio.shapers()).toBe(1);
    const curve = audio.curve();
    if (!curve) throw new Error("曲線がない");
    const at = (input: number) => curve[Math.round(((input + 1) / 2) * (curve.length - 1))] ?? 0;
    expect(at(0)).toBeCloseTo(0);
    expect(at(0.4)).toBeCloseTo(Math.tanh(0.4), 2);
    expect(at(1)).toBeLessThan(0.8);
    expect(audio.connections.filter((link) => link === "shaper>destination")).toHaveLength(1);
    expect(
      audio.connections
        .filter((link) => link.startsWith("gain>"))
        .every((link) => link === "gain>shaper"),
    ).toBe(true);
  });
});
