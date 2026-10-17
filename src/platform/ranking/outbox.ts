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

/** 通信やサーバーの不具合。ここで止めて、次のきっかけで送り直す */
const STOP = new Set(["network", "internal"]);

export function createOutbox(key: string) {
  const store = createPersistentStore(key, parsePending);
  let flushing: Promise<void> | null = null;

  const same = (a: PendingScore, b: PendingScore) =>
    a.at === b.at && a.game === b.game && a.mode === b.mode && a.score === b.score;
  const remove = (item: PendingScore) =>
    store.set((items) => items.filter((pending) => !same(pending, item)));

  async function run(send: (item: PendingScore) => Promise<unknown>): Promise<void> {
    // 続けて送りすぎと断られたゲームは、この回は飛ばしてほかのゲームを送る
    const refused = new Set<string>();
    for (const item of store.get()) {
      if (refused.has(item.game)) continue;
      try {
        await send(item);
        remove(item);
      } catch (error) {
        const code = error instanceof ApiRequestError ? error.code : null;
        if (code === null || STOP.has(code)) return;
        if (code === "too_many_requests") refused.add(item.game);
        else remove(item);
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
