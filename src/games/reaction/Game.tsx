import { useEffect, useEffectEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useGameKeys } from "@/sdk/hooks.ts";
import { createRng } from "@/sdk/rng.ts";
import type { GameProps } from "@/sdk/types.ts";
import {
  averageTime,
  createReaction,
  next,
  press,
  type ReactionState,
  ROUNDS,
  resume,
  signal,
  signalDueAt,
} from "./logic.ts";

const WIDTH = 1600;
const HEIGHT = 900;
const CENTER_X = WIDTH / 2;
const CIRCLE_Y = 380;
const RADIUS = 120;
const LABEL_Y = 640;
/** 結果や「早すぎた」を見せてから次の回に進むまで */
const ADVANCE = 1_200;

function describe(state: ReactionState): string {
  switch (state.phase) {
    case "waiting":
      return "合図を待つ";
    case "signal":
      return "押す";
    case "result":
      return `${state.last} ミリ秒`;
    case "early":
      return "早すぎた。合図が出てから押す";
    case "over":
      return `おしまい。最後は ${state.last} ミリ秒`;
  }
}

/** イベントの timeStamp は performance.now() と同じ時計。取れなければいまの時刻 */
function eventTime(timeStamp: number): number {
  return timeStamp > 0 ? timeStamp : performance.now();
}

function Label({ y, children, tone }: { y: number; children: string; tone: string }) {
  return (
    <text
      x={CENTER_X}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fill: tone, font: "600 64px var(--font-sans)" }}
    >
      {children}
    </text>
  );
}

function Scene({ state }: { state: ReactionState }) {
  switch (state.phase) {
    case "waiting":
      return (
        <>
          <rect width={WIDTH} height={HEIGHT} style={{ fill: "var(--bg-subtle)" }} />
          <circle
            cx={CENTER_X}
            cy={CIRCLE_Y}
            r={RADIUS}
            style={{ fill: "none", stroke: "var(--border)", strokeWidth: 6 }}
          />
          <Label y={LABEL_Y} tone="var(--ink-muted)">
            合図を待つ
          </Label>
        </>
      );
    case "signal":
      return (
        <>
          <rect width={WIDTH} height={HEIGHT} style={{ fill: "var(--accent)" }} />
          <circle cx={CENTER_X} cy={CIRCLE_Y} r={RADIUS} style={{ fill: "var(--bg)" }} />
          <Label y={LABEL_Y} tone="var(--bg)">
            押す
          </Label>
        </>
      );
    case "early":
      return (
        <>
          <rect width={WIDTH} height={HEIGHT} style={{ fill: "var(--bg)" }} />
          <circle
            cx={CENTER_X}
            cy={CIRCLE_Y}
            r={RADIUS}
            style={{
              fill: "none",
              stroke: "var(--danger)",
              strokeWidth: 6,
              strokeDasharray: "24 18",
            }}
          />
          <Label y={LABEL_Y - 40} tone="var(--ink)">
            早すぎた
          </Label>
          <text
            x={CENTER_X}
            y={LABEL_Y + 50}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: "var(--ink-muted)", font: "400 40px var(--font-sans)" }}
          >
            合図が出てから押す。この回はやり直し
          </text>
        </>
      );
    case "result":
    case "over": {
      const remaining = ROUNDS - state.times.length;
      return (
        <>
          <rect width={WIDTH} height={HEIGHT} style={{ fill: "var(--bg)" }} />
          <text
            x={CENTER_X}
            y={CIRCLE_Y}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: "var(--ink)", font: "600 200px var(--font-mono)" }}
          >
            {state.last}
            <tspan style={{ fill: "var(--ink-muted)", font: "400 64px var(--font-sans)" }}>
              {" ms"}
            </tspan>
          </text>
          <text
            x={CENTER_X}
            y={LABEL_Y}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: "var(--ink-muted)", font: "400 40px var(--font-sans)" }}
          >
            {remaining > 0 ? `あと ${remaining} 回` : "おしまい"}
          </text>
        </>
      );
    }
  }
}

export default function ReactionGame({ paused, seed, sound, onHud, onFinish }: GameProps) {
  const [rng] = useState(() => createRng(seed));
  const [state, setState] = useState(() => createReaction(rng, performance.now()));
  const finished = useRef(false);
  const wasPaused = useRef(paused);

  const average = averageTime(state);
  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    const round =
      state.phase === "result" || state.phase === "over"
        ? state.times.length
        : state.times.length + 1;
    reportHud([
      { label: "回", value: `${Math.min(round, ROUNDS)} / ${ROUNDS}` },
      average === null
        ? { label: "平均", value: "—" }
        : { label: "平均", value: String(average), unit: "ms" },
    ]);
  }, [state.phase, state.times.length, average]);

  const finish = useEffectEvent(() => {
    if (finished.current) return;
    const score = averageTime(state);
    if (score === null) return;
    finished.current = true;
    onFinish({
      score,
      stats: [
        { label: "最速", value: String(Math.min(...state.times)), unit: "ms" },
        { label: "最遅", value: String(Math.max(...state.times)), unit: "ms" },
      ],
    });
  });

  useEffect(() => {
    if (paused) {
      wasPaused.current = true;
      return;
    }
    if (wasPaused.current) {
      wasPaused.current = false;
      if (state.phase !== "over") {
        // 一時停止から戻ったら、まだ終えていない回を待ちからやり直す
        setState((current) => resume(current, rng, performance.now()));
        return;
      }
    }
    if (state.phase === "waiting") {
      const wait = Math.max(0, signalDueAt(state) - performance.now());
      const timer = setTimeout(() => {
        // 合図を描いた時刻から測るため、更新をすぐに画面へ反映させる
        const at = performance.now();
        flushSync(() => setState((current) => signal(current, at)));
      }, wait);
      return () => clearTimeout(timer);
    }
    if (state.phase === "result" || state.phase === "early") {
      const timer = setTimeout(
        () => setState((current) => next(current, rng, performance.now())),
        ADVANCE,
      );
      return () => clearTimeout(timer);
    }
    if (state.phase === "over") {
      const timer = setTimeout(finish, ADVANCE);
      return () => clearTimeout(timer);
    }
  }, [state, paused, rng]);

  const pressAt = (at: number) => {
    if (paused) return;
    const after = press(state, at);
    if (after === state) return;
    sound.play(after.phase === "early" ? "bad" : "tap");
    setState(after);
  };

  useGameKeys((event) => {
    if (event.key !== " " && event.key !== "Enter") return undefined;
    if (!event.repeat) pressAt(eventTime(event.timeStamp));
    return true;
  }, !paused);

  return (
    <svg
      className="game-svg"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={describe(state)}
      onPointerDown={(event) => {
        event.preventDefault();
        pressAt(eventTime(event.timeStamp));
      }}
      style={{ cursor: "pointer" }}
    >
      <Scene state={state} />
    </svg>
  );
}
