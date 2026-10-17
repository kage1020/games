import type { Sound, SoundName } from "@/sdk/types.ts";

interface Tone {
  frequencies: number[];
  /** 1 音の長さ（秒） */
  length: number;
  type: OscillatorType;
}

const TONES: Record<SoundName, Tone> = {
  tap: { frequencies: [660], length: 0.05, type: "triangle" },
  good: { frequencies: [660, 880], length: 0.07, type: "triangle" },
  bad: { frequencies: [220, 165], length: 0.1, type: "square" },
  clear: { frequencies: [523, 659, 784], length: 0.09, type: "triangle" },
  over: { frequencies: [392, 330, 262], length: 0.12, type: "triangle" },
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

/** 小さな合図の音。volume は 0〜1 */
export function createSound(volume: () => number): Sound {
  return {
    play(name) {
      const level = volume();
      if (level <= 0) return;
      const ctx = audio();
      if (!ctx) return;
      const tone = TONES[name];
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const peak = 0.12 * level;
      tone.frequencies.forEach((frequency, i) => {
        const start = ctx.currentTime + i * tone.length;
        const oscillator = ctx.createOscillator();
        oscillator.type = tone.type;
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        gain.gain.setValueAtTime(peak, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.length);
        oscillator.start(start);
        oscillator.stop(start + tone.length);
      });
    },
  };
}
