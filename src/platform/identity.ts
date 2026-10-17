import { generateCode, normalizeCode } from "@shared/code.ts";
import { createPersistentStore } from "./store.ts";

const IDENTITY_KEY = "kg-games:identity:v1";

function parseIdentity(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "string" ? normalizeCode(value) : null;
  } catch {
    return null;
  }
}

/** この端末の引き継ぎコード。初めて要るときに作る */
export const identityStore = createPersistentStore(IDENTITY_KEY, parseIdentity);

export function ensureCode(): string {
  const existing = identityStore.get();
  if (existing) return existing;
  const code = generateCode();
  identityStore.set(code);
  return code;
}
