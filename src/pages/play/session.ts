import type { RecordOutcome } from "@/platform/records/records.ts";
import type { GameResult } from "@/sdk/types.ts";

export type SessionStatus = "ready" | "playing" | "paused" | "finished";

export interface SessionState {
  status: SessionStatus;
  run: number;
  timed: boolean;
  result: GameResult | null;
}

export type SessionAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "finish"; result: GameResult }
  | { type: "restart" }
  | { type: "reset" };

export function createSession(timed: boolean): SessionState {
  return { status: "ready", run: 0, timed, result: null };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "start":
      return state.status === "ready"
        ? { ...state, status: "playing", run: state.run + 1, result: null }
        : state;
    case "pause":
      return state.status === "playing" && state.timed ? { ...state, status: "paused" } : state;
    case "resume":
      return state.status === "paused" ? { ...state, status: "playing" } : state;
    case "finish":
      return state.status === "playing" || state.status === "paused"
        ? { ...state, status: "finished", result: action.result }
        : state;
    case "restart":
      return { ...state, status: "playing", run: state.run + 1, result: null };
    case "reset":
      return { ...state, status: "ready", result: null };
  }
}

export function describeResult(
  score: number | null,
  outcome: Pick<RecordOutcome, "isFirst" | "isBest" | "isTie" | "previousBest">,
  formatScore: (score: number) => string,
  gameNote?: string,
): { note: string; celebrate: boolean } {
  if (score === null) return { note: gameNote ?? "記録は残らない。", celebrate: false };
  if (outcome.isFirst) return { note: "はじめての記録。", celebrate: false };
  if (outcome.isBest) return { note: "自己ベストを更新した。", celebrate: true };
  if (outcome.isTie) return { note: "自己ベストに並んだ。", celebrate: false };
  const best = outcome.previousBest;
  return {
    note: best === null ? "記録を残した。" : `自己ベストは ${formatScore(best)}。`,
    celebrate: false,
  };
}
