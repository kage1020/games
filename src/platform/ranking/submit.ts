import type { ScoreResponse } from "@shared/api.ts";
import { ensureCode, identityStore } from "../identity.ts";
import { settingsStore } from "../settings.ts";
import { type ApiClient, ApiRequestError } from "./client.ts";
import { outbox, type PendingScore } from "./outbox.ts";

const RETRYABLE = new Set(["network", "internal", "too_many_requests"]);
/** サーバーは同じゲームの記録を 2 秒あけてから受け付ける */
const RESEND_DELAY = 2_500;

function withName(score: PendingScore): PendingScore {
  const name = settingsStore.get().name;
  return name ? { ...score, name } : score;
}

/** 送信待ちを送る。コードがまだなければ送るものもない */
export function flushPending(api: ApiClient): Promise<void> {
  const code = identityStore.get();
  if (!code) return Promise.resolve();
  return outbox.flush((item) => api.submitScore(code, withName(item)));
}

/** 記録を送る。後で通りそうな失敗は送信待ちに積み、null を返す */
export async function submitScore(
  api: ApiClient,
  score: PendingScore,
): Promise<ScoreResponse | null> {
  const code = ensureCode();
  try {
    const response = await api.submitScore(code, withName(score));
    setTimeout(() => void flushPending(api), RESEND_DELAY);
    return response;
  } catch (error) {
    if (error instanceof ApiRequestError && RETRYABLE.has(error.code)) outbox.add(score);
    return null;
  }
}
