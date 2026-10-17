import type { Period } from "./period.ts";

export interface ScoreSubmission {
  game: string;
  mode: string;
  score: number;
  at?: number;
  name?: string;
}

export interface RankPosition {
  rank: number;
  total: number;
}

export interface ScoreResponse {
  best: number;
  ranks: Record<Period, RankPosition>;
}

export interface RankingEntry {
  rank: number;
  name: string;
  score: number;
}

export interface RankingRow extends RankingEntry {
  me: boolean;
}

export interface RankingResponse {
  rows: RankingRow[];
  me: RankingEntry | null;
  total: number;
}

export interface PlayerBest {
  game: string;
  mode: string;
  best: number;
  plays: number;
}

export interface MeResponse {
  name: string;
  bests: PlayerBest[];
}

export type ApiErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "not_found"
  | "method_not_allowed"
  | "too_many_requests"
  | "internal";

export interface ApiErrorBody {
  error: { code: ApiErrorCode };
}
