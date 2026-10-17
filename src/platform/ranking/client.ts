import type {
  ApiErrorCode,
  MeResponse,
  RankingResponse,
  ScoreResponse,
  ScoreSubmission,
} from "@shared/api.ts";
import type { Period } from "@shared/period.ts";

export type ApiFailure = ApiErrorCode | "network";

export class ApiRequestError extends Error {
  constructor(readonly code: ApiFailure) {
    super(code);
  }
}

const ERROR_CODES: readonly ApiErrorCode[] = [
  "unauthorized",
  "invalid_request",
  "not_found",
  "method_not_allowed",
  "too_many_requests",
  "internal",
];

export interface RankingQuery {
  game: string;
  mode: string;
  period: Period;
  limit?: number;
}

export interface ApiClient {
  submitScore(code: string, submission: ScoreSubmission): Promise<ScoreResponse>;
  getRanking(query: RankingQuery, code: string | null): Promise<RankingResponse>;
  getMe(code: string): Promise<MeResponse>;
  /** null は既定の名前に戻す */
  putName(code: string, name: string | null): Promise<{ name: string }>;
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function errorCode(response: Response): Promise<ApiErrorCode> {
  try {
    const body = (await response.json()) as { error?: { code?: string } };
    const code = body.error?.code;
    return ERROR_CODES.find((known) => known === code) ?? "internal";
  } catch {
    return "internal";
  }
}

export function createApiClient(fetchImpl: Fetch = (input, init) => fetch(input, init)): ApiClient {
  async function request<T>(
    path: string,
    { code, method = "GET", body }: { code?: string | null; method?: string; body?: unknown },
  ): Promise<T> {
    const headers = new Headers({ accept: "application/json" });
    if (code) headers.set("authorization", `Bearer ${code}`);
    if (body !== undefined) headers.set("content-type", "application/json");
    let response: Response;
    try {
      response = await fetchImpl(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiRequestError("network");
    }
    if (!response.ok) throw new ApiRequestError(await errorCode(response));
    return (await response.json()) as T;
  }

  return {
    submitScore: (code, submission) =>
      request("/api/scores", { code, method: "POST", body: submission }),
    getRanking: ({ game, mode, period, limit = 10 }, code) => {
      const query = new URLSearchParams({ game, mode, period, limit: String(limit) });
      return request(`/api/rankings?${query}`, { code });
    },
    getMe: (code) => request("/api/me", { code }),
    putName: (code, name) => request("/api/me", { code, method: "PUT", body: { name } }),
  };
}

export const apiClient = createApiClient();
