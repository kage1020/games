import type { Rng } from "@/sdk/rng.ts";

export const ROUNDS = 5;
export const MIN_DELAY = 1_500;
export const MAX_DELAY = 4_000;

/** waiting → signal → result の順に 1 回が進む。合図の前に押すと early */
export type Phase = "waiting" | "signal" | "result" | "early" | "over";

export interface ReactionState {
  phase: Phase;
  /** この回の待ち（ミリ秒） */
  delay: number;
  waitStartedAt: number;
  signalAt: number | null;
  /** 終えた回の記録（ミリ秒） */
  times: number[];
  last: number | null;
}

function drawDelay(rng: Rng): number {
  return Math.floor(rng.between(MIN_DELAY, MAX_DELAY));
}

function waiting(
  state: Omit<ReactionState, "phase" | "delay" | "waitStartedAt" | "signalAt">,
  rng: Rng,
  now: number,
): ReactionState {
  return { ...state, phase: "waiting", delay: drawDelay(rng), waitStartedAt: now, signalAt: null };
}

export function createReaction(rng: Rng, now: number): ReactionState {
  return waiting({ times: [], last: null }, rng, now);
}

/** 合図を出すべき時刻 */
export function signalDueAt(state: ReactionState): number {
  return state.waitStartedAt + state.delay;
}

export function signal(state: ReactionState, at: number): ReactionState {
  if (state.phase !== "waiting") return state;
  return { ...state, phase: "signal", signalAt: at };
}

export function press(state: ReactionState, at: number): ReactionState {
  if (state.phase === "waiting") return { ...state, phase: "early" };
  if (state.phase !== "signal" || state.signalAt === null) return state;
  // 合図の描画と同じ頃に届いた入力は、押した時刻で合図の前か後かを決める
  if (at < state.signalAt) return { ...state, phase: "early", signalAt: null };
  const time = Math.round(at - state.signalAt);
  const times = [...state.times, time];
  return { ...state, times, last: time, phase: times.length >= ROUNDS ? "over" : "result" };
}

/** 結果か早すぎたのあと、次の待ちに進む。早すぎたときは同じ回をやり直す */
export function next(state: ReactionState, rng: Rng, now: number): ReactionState {
  if (state.phase !== "result" && state.phase !== "early") return state;
  return waiting(state, rng, now);
}

/** 一時停止から戻ったら、まだ終えていない回を待ちからやり直す */
export function resume(state: ReactionState, rng: Rng, now: number): ReactionState {
  if (state.phase === "over") return state;
  return waiting(state, rng, now);
}

export function averageTime(state: ReactionState): number | null {
  if (state.times.length === 0) return null;
  return Math.round(state.times.reduce((sum, time) => sum + time, 0) / state.times.length);
}
