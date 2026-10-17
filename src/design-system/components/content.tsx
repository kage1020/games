import {
  Children,
  type CSSProperties,
  type ReactNode,
  type Ref,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { aspectRatio, cx, useReducedMotion, visuallyHidden } from "../internal.ts";
import { useLinkComponent } from "../link.tsx";
import { Button } from "./Button.tsx";

type Aspect = "wide" | "square" | "tall";

export interface ContentCardProps {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  thumb?: string | ReactNode;
  aspect?: Aspect;
  badge?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

/** コンテンツの入口。展示のキャプションのように */
export function ContentCard({
  title,
  description,
  meta,
  thumb,
  aspect,
  badge,
  href,
  onClick,
  className,
}: ContentCardProps) {
  const Link = useLinkComponent();
  const body = (
    <>
      <span className="kg-card-thumb" style={{ aspectRatio: aspectRatio(aspect) }}>
        {typeof thumb === "string" ? <img src={thumb} alt="" /> : thumb}
      </span>
      <span className="kg-card-cap">
        <span className="kg-card-title">
          {title}
          {badge ? <span className="kg-badge">{badge}</span> : null}
        </span>
        {description ? <span className="kg-card-desc">{description}</span> : null}
        {meta ? <span className="kg-card-meta">{meta}</span> : null}
      </span>
    </>
  );
  return href !== undefined ? (
    <Link href={href} className={cx("kg-card", className)} onClick={onClick}>
      {body}
    </Link>
  ) : (
    <button type="button" className={cx("kg-card", className)} onClick={onClick}>
      {body}
    </button>
  );
}

/** カードを並べる格子。初めて並ぶときは 40ms ずつ、6 個目まで順に現れる */
export function Gallery({
  children,
  min = 220,
  className,
}: {
  children?: ReactNode;
  min?: number;
  className?: string;
}) {
  return (
    <ul
      className={cx("kg-gallery", className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}
    >
      {Children.map(children, (child, i) => (
        <li className="kg-enter" style={{ "--kg-i": Math.min(i, 5) } as CSSProperties}>
          {child}
        </li>
      ))}
    </ul>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </svg>
  );
}

export interface StageProps {
  /** コンテンツの描画 */
  children?: ReactNode;
  title: ReactNode;
  aspect?: Aspect;
  hud?: ReactNode;
  controls?: ReactNode;
  paused?: boolean;
  /** 時間の流れるコンテンツだけ渡す。Esc で一時停止、一時停止中の Esc で再開 */
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onExit?: () => void;
  style?: CSSProperties;
  className?: string;
  /** 中身の描画面。始めたときにフォーカスを移すために使う */
  screenRef?: Ref<HTMLDivElement>;
}

/** コンテンツの額縁。額縁はこのシステム、中身はコンテンツの自由 */
export function Stage({
  children,
  title,
  aspect,
  hud,
  controls,
  paused = false,
  onPause,
  onResume,
  onRestart,
  onExit,
  style,
  className,
  screenRef,
}: StageProps) {
  const ref = useRef<HTMLElement>(null);
  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (paused && onResume) {
      event.preventDefault();
      onResume();
    } else if (!paused && onPause) {
      event.preventDefault();
      onPause();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onEscape(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.();
  };

  return (
    <section
      className={cx("kg-stage", className)}
      style={style}
      ref={ref}
      aria-label={typeof title === "string" ? title : "コンテンツ"}
    >
      <header className="kg-stage-bar">
        <span className="kg-stage-title">{title}</span>
        {hud ? <div className="kg-stage-hud">{hud}</div> : null}
        <div className="kg-stage-actions">
          {onPause && !paused ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<PauseIcon />}
              aria-label="一時停止（Esc）"
              onClick={onPause}
            />
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            icon={<FullscreenIcon />}
            aria-label="全画面"
            onClick={toggleFullscreen}
          />
        </div>
      </header>
      <div className="kg-stage-well">
        <div
          className="kg-stage-screen"
          style={{ aspectRatio: aspectRatio(aspect) }}
          ref={screenRef}
          tabIndex={-1}
        >
          {children}
          {paused ? (
            <div className="kg-pause" role="dialog" aria-modal="true" aria-label="一時停止中">
              <p className="kg-pause-title">一時停止中</p>
              <div className="kg-pause-actions">
                <Button variant="primary" onClick={onResume} autoFocus>
                  続ける
                </Button>
                {onRestart ? <Button onClick={onRestart}>はじめから</Button> : null}
                {onExit ? (
                  <Button variant="link" onClick={onExit}>
                    やめて一覧へ
                  </Button>
                ) : null}
              </div>
              <p className="kg-pause-hint">Esc で続ける</p>
            </div>
          ) : null}
        </div>
      </div>
      {controls ? <footer className="kg-stage-foot">{controls}</footer> : null}
    </section>
  );
}

/** 数を 0 から目標まで数え上げる（ease-out）。動きを減らす設定では即座に目標値 */
function useCountUp(target: number | null, duration: number): number | null {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(reduce || target === null ? target : 0);
  useEffect(() => {
    if (target === null || reduce) {
      setShown(target);
      return;
    }
    let start: number | null = null;
    let frame = 0;
    const step = (time: number) => {
      start ??= time;
      const progress = Math.min(1, (time - start) / duration);
      setShown(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduce, duration]);
  return shown;
}

export interface ResultProps {
  /** 整形済みの記録 */
  score?: ReactNode;
  /** 数。0 から 600ms で数え上がる */
  value?: number;
  format?: (n: number) => string;
  /** 本当にうれしいときだけ。数え終わりに一度だけ弾む */
  celebrate?: boolean;
  label?: ReactNode;
  note?: ReactNode;
  stats?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** 1 回の結果。大きな数字ひとつと、何が起きたかの一行 */
export function Result({
  score,
  value,
  format,
  celebrate,
  label = "スコア",
  note,
  stats,
  actions,
  className,
}: ResultProps) {
  const counted = useCountUp(value ?? null, 600);
  const render = (n: number) => (format ? format(n) : n.toLocaleString("ja-JP"));
  const shown = value !== undefined && counted !== null ? render(counted) : score;
  const done = value === undefined || counted === value;
  return (
    <section className={cx("kg-result", className)}>
      <p className="kg-result-label">{label}</p>
      <p className={cx("kg-result-score", celebrate && done && "is-celebrate")}>
        {value === undefined ? (
          shown
        ) : (
          <>
            <span aria-hidden="true">{shown}</span>
            <span style={visuallyHidden}>{render(value)}</span>
          </>
        )}
      </p>
      {note ? (
        <p className={cx("kg-result-note", done && "is-shown")} aria-live="polite">
          {done ? note : null}
        </p>
      ) : null}
      {stats ? <div className="kg-result-stats">{stats}</div> : null}
      {actions ? <div className="kg-result-actions">{actions}</div> : null}
    </section>
  );
}
