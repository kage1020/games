import type { ScoreSubmission } from "@shared/api.ts";
import { createPersistentStore } from "../store.ts";
import { ApiRequestError } from "./client.ts";

export interface PendingScore extends ScoreSubmission {
  at: number;
}

function parsePending(raw: string | null): PendingScore[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is PendingScore =>
        item !== null &&
        typeof item === "object" &&
        typeof item.game === "string" &&
        typeof item.mode === "string" &&
        typeof item.score === "number" &&
        typeof item.at === "number",
    );
  } catch {
    return [];
  }
}

/** 後で送り直せば通る失敗。それ以外（不正な記録など）は捨てる */
const RETRYABLE = new Set(["network", "internal", "too_many_requests"]);

export function createOutbox(key: string) {
  const store = createPersistentStore(key, parsePending);
  let flushing: Promise<void> | null = null;

  const same = (a: PendingScore, b: PendingScore) =>
    a.at === b.at && a.game === b.game && a.mode === b.mode && a.score === b.score;
  const remove = (item: PendingScore) =>
    store.set((items) => items.filter((pending) => !same(pending, item)));

  async function run(send: (item: PendingScore) => Promise<unknown>): Promise<void> {
    for (const item of store.get()) {
      try {
        await send(item);
        remove(item);
      } catch (error) {
        if (error instanceof ApiRequestError && RETRYABLE.has(error.code)) return;
        remove(item);
      }
    }
  }

  return {
    store,
    pending: () => store.get(),
    add(item: PendingScore) {
      store.set((items) => [...items, item]);
    },
    /** 送信待ちを古い順に送る。同時には 1 つしか走らない */
    flush(send: (item: PendingScore) => Promise<unknown>): Promise<void> {
      flushing ??= run(send).finally(() => {
        flushing = null;
      });
      return flushing;
    },
  };
}

export const outbox = createOutbox("kg-games:outbox:v1");
