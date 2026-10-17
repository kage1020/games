import type { ReactNode } from "react";
import { cx } from "../internal.ts";

export interface NoticeProps {
  tone?: "neutral" | "danger";
  children: ReactNode;
  onUndo?: () => void;
  undoLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

/** 操作の結果を流れの中で知らせる。自動で消さない */
export function Notice({
  tone = "neutral",
  children,
  onUndo,
  undoLabel = "元に戻す",
  onDismiss,
  className,
}: NoticeProps) {
  return (
    <div
      className={cx("kg-notice", `kg-notice-${tone}`, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <p className="kg-notice-msg">{children}</p>
      <div className="kg-notice-actions">
        {onUndo ? (
          <button type="button" className="kg-notice-undo" onClick={onUndo}>
            {undoLabel}
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            className="kg-notice-close"
            onClick={onDismiss}
            aria-label="閉じる"
            title="閉じる"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
