import type { ApiErrorCode } from "@shared/api.ts";

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  not_found: 404,
  method_not_allowed: 405,
  too_many_requests: 429,
  internal: 500,
};

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code);
  }
}

export function errorResponse(code: ApiErrorCode): Response {
  return json({ error: { code } }, STATUS[code]);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body !== null && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // 本文が JSON でなければ下の 400 にまとめる
  }
  throw new ApiError("invalid_request");
}
