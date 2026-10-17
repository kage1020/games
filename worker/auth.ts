import { normalizeCode } from "@shared/code.ts";
import { ApiError } from "./http.ts";

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Authorization ヘッダーのコードからプレイヤーキーを作る。ヘッダーがなければ null */
export async function playerKey(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const code = match?.[1] ? normalizeCode(match[1]) : null;
  if (code === null) throw new ApiError("unauthorized");
  return sha256Hex(code);
}

export async function requirePlayerKey(request: Request): Promise<string> {
  const key = await playerKey(request);
  if (key === null) throw new ApiError("unauthorized");
  return key;
}
