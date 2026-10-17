import { type CSSProperties, useCallback, useState, useSyncExternalStore } from "react";

export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

/** value があれば外から決め、なければ中で持つ。どちらでも onChange は呼ぶ */
export function useControlled<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const set = useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [controlled ? value : inner, set];
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(notify: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener("change", notify);
  return () => query?.removeEventListener("change", notify);
}

/** 動きを減らす設定。JS で動かすものはこれを見る */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia?.(REDUCED_MOTION).matches ?? false,
    () => false,
  );
}

export function aspectRatio(aspect: "wide" | "square" | "tall" | undefined): string {
  return aspect === "square" ? "1 / 1" : aspect === "tall" ? "3 / 4" : "16 / 9";
}

/** 読み上げにだけ渡す文字 */
export const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};
