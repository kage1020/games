import type { Sound, SoundName } from "@/sdk/types.ts";

interface Tone {
  frequencies: number[];
  /** 1 音の長さ（秒） */
  length: number;
  type: OscillatorType;
}

const TONES: Record<SoundName, Tone> = {
  tap: { frequencies: [660], length: 0.05, type: "triangle" },
  flag: { frequencies: [990], length: 0.04, type: "sine" },
  good: { frequencies: [660, 880], length: 0.07, type: "triangle" },
  bad: { frequencies: [220, 165], length: 0.1, type: "square" },
  clear: { frequencies: [523, 659, 784], length: 0.09, type: "triangle" },
  over: { frequencies: [392, 330, 262], length: 0.12, type: "triangle" },
};

/** 音量 100% のときのピークの振幅 */
const PEAK = 0.4;
/** 鳴り始めを立ち上げる時間（秒）。いきなり鳴らすとプツッと鳴る */
const ATTACK = 0.005;
const SILENT = 0.0001;
/** 重なった音をなめらかに頭打ちにする曲線の細かさ */
const CURVE_POINTS = 1025;

/** 対応する端末で音と一緒に出す振動（ミリ秒） */
const VIBRATIONS: Partial<Record<SoundName, number>> = {
  flag: 15,
};

let audio: { context: AudioContext; output: AudioNode } | null = null;

function getAudio(): { context: AudioContext; output: AudioNode } | null {
  if (typeof AudioContext === "undefined") return null;
  if (!audio) {
    const context = new AudioContext();
    // 音が重なっても割れないように、tanh の曲線でなめらかに頭打ちにする。
    // DynamicsCompressor は先読みと立ち上がりのせいで、短い合図の音まで小さくしてしまう
    const output = context.createWaveShaper();
    output.curve = Float32Array.from({ length: CURVE_POINTS }, (_, i) =>
      Math.tanh((i / (CURVE_POINTS - 1)) * 2 - 1),
    );
    output.connect(context.destination);
    audio = { context, output };
  }
  if (audio.context.state === "suspended") void audio.context.resume();
  return audio;
}

/** 小さな合図の音と、対応する端末では短い振動。volume は 0〜1 で、0 なら振動もしない */
export function createSound(volume: () => number): Sound {
  return {
    play(name) {
      const level = volume();
      if (level <= 0) return;
      const vibration = VIBRATIONS[name];
      if (vibration !== undefined && "vibrate" in navigator) navigator.vibrate(vibration);
      const current = getAudio();
      if (!current) return;
      const { context, output } = current;
      const tone = TONES[name];
      const peak = PEAK * level;
      tone.frequencies.forEach((frequency, i) => {
        const start = context.currentTime + i * tone.length;
        const gain = context.createGain();
        gain.connect(output);
        gain.gain.setValueAtTime(SILENT, start);
        gain.gain.linearRampToValueAtTime(peak, start + ATTACK);
        gain.gain.exponentialRampToValueAtTime(SILENT, start + tone.length);
        const oscillator = context.createOscillator();
        oscillator.type = tone.type;
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(start);
        oscillator.stop(start + tone.length);
      });
    },
  };
}
