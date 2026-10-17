import type { RankingResponse } from "@shared/api.ts";
import type { Period } from "@shared/period.ts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { identityStore } from "../identity.ts";
import { useStore } from "../store.ts";
import { useApi } from "./context.tsx";

export type RankingState =
  | { status: "loading"; data: RankingResponse | null }
  | { status: "error"; data: null }
  | { status: "ready"; data: RankingResponse };

/** version を変えると読み直す（記録を送ったあとなど） */
export function useRanking(game: string, mode: string, period: Period, version: number) {
  const api = useApi();
  const code = useStore(identityStore);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RankingState>({ status: "loading", data: null });
  const request = useMemo(
    () => ({ query: { game, mode, period }, code, attempt, version }),
    [game, mode, period, code, attempt, version],
  );

  useEffect(() => {
    let active = true;
    setState((current) => ({
      status: "loading",
      data: current.status === "ready" ? current.data : null,
    }));
    api
      .getRanking(request.query, request.code)
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch(() => {
        if (active) setState({ status: "error", data: null });
      });
    return () => {
      active = false;
    };
  }, [api, request]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
