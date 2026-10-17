import { useSyncExternalStore } from "react";
import { Notice } from "@/design-system/index.ts";

export interface NoticeMessage {
  id: number;
  message: string;
  tone: "neutral" | "danger";
  onUndo?: () => void;
}

let current: NoticeMessage | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** 画面下端に 1 つだけ出す。自動では消さず、次の通知か × で入れ替わる */
export function showNotice(
  notice: Omit<NoticeMessage, "id" | "tone"> & { tone?: "neutral" | "danger" },
) {
  current = { tone: "neutral", ...notice, id: nextId++ };
  emit();
}

export function dismissNotice() {
  current = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function NoticeArea() {
  const notice = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  if (!notice) return null;
  return (
    <div className="notice-area">
      <Notice
        key={notice.id}
        tone={notice.tone}
        onUndo={
          notice.onUndo
            ? () => {
                notice.onUndo?.();
                dismissNotice();
              }
            : undefined
        }
        onDismiss={dismissNotice}
      >
        {notice.message}
      </Notice>
    </div>
  );
}
