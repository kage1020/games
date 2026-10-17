import { type ReactNode, useId } from "react";
import { cx, useControlled } from "../internal.ts";
import { useLinkComponent } from "../link.tsx";

function Chevron({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

/** 今いる場所と、そこまでの道筋 */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const Link = useLinkComponent();
  return (
    <nav aria-label="パンくず" className={cx("kg-crumb", className)}>
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.href ?? "current"}>
              {last ? (
                <span aria-current="page" className="kg-crumb-cur">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href ?? "/"} className="kg-crumb-link">
                  {item.label}
                </Link>
              )}
              {last ? null : <Chevron className="kg-crumb-sep" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type Option = string | { value: string; label: ReactNode; description?: ReactNode };

export function normalizeOptions(options: Option[]) {
  return options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
}

export interface SegmentedProps {
  options: Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** 読み上げ用の問い */
  label?: string;
  className?: string;
}

/** 2〜4 択の切り替え。中身はネイティブの radio なので ← → で移動できる */
export function Segmented({
  options,
  value,
  defaultValue,
  onChange,
  label,
  className,
}: SegmentedProps) {
  const name = useId();
  const items = normalizeOptions(options);
  const [current, setCurrent] = useControlled(
    value,
    defaultValue ?? items[0]?.value ?? "",
    onChange,
  );
  return (
    <div role="radiogroup" aria-label={label} className={cx("kg-seg", className)}>
      {items.map((item) => (
        <label key={item.value} className="kg-seg-item">
          <input
            type="radio"
            className="kg-seg-input"
            name={name}
            value={item.value}
            checked={item.value === current}
            onChange={() => setCurrent(item.value)}
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}

export interface AppBarAction {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}

function ActionIcon({ icon }: { icon: ReactNode }) {
  return (
    <span className="kg-icon is-lg" aria-hidden="true">
      {icon}
    </span>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

/** 狭い画面の上端。操作は 3 つまで */
export function AppBar({
  title,
  subtitle,
  actions = [],
  onBack,
  backHref,
  backLabel = "戻る",
  leading,
  titleAs: Title = "h1",
  className,
}: {
  title: ReactNode;
  /** 画面に別の h1 があるときは div にする */
  titleAs?: "h1" | "div";
  subtitle?: ReactNode;
  actions?: AppBarAction[];
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  leading?: ReactNode;
  className?: string;
}) {
  const Link = useLinkComponent();
  return (
    <header className={cx("kg-appbar", className)}>
      {backHref ? (
        <Link href={backHref} className="kg-appbar-btn" aria-label={backLabel} title={backLabel}>
          <BackIcon />
        </Link>
      ) : onBack ? (
        <button
          type="button"
          className="kg-appbar-btn"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
        >
          <BackIcon />
        </button>
      ) : null}
      {leading}
      <Title className="kg-appbar-title">
        {title}
        {subtitle ? <span className="kg-appbar-sub">{subtitle}</span> : null}
      </Title>
      <div className="kg-appbar-actions">
        {actions.slice(0, 3).map((action) =>
          action.href ? (
            <Link
              key={action.label}
              href={action.href}
              className="kg-appbar-btn"
              aria-label={action.label}
              title={action.label}
            >
              <ActionIcon icon={action.icon} />
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              className="kg-appbar-btn"
              aria-label={action.label}
              title={action.label}
              onClick={action.onClick}
            >
              <ActionIcon icon={action.icon} />
            </button>
          ),
        )}
      </div>
    </header>
  );
}
