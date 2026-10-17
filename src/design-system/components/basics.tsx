import type { ReactNode } from "react";
import { Fragment } from "react";
import { cx } from "../internal.ts";

/** 1〜2 語の補足ラベル。チップにしない */
export function Badge({
  children,
  mono,
  className,
}: {
  children?: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return <span className={cx("kg-badge", mono && "is-mono", className)}>{children}</span>;
}

/** キー操作のヒント。keys は + でつなぐ */
export function Kbd({
  keys,
  children,
  className,
}: {
  keys?: string[];
  children?: string;
  className?: string;
}) {
  const list = keys ?? (children ? [children] : []);
  return (
    <span className={cx("kg-kbd-group", className)}>
      {list.map((key, i) => (
        <Fragment key={key}>
          {i > 0 ? (
            <span className="kg-kbd-plus" aria-hidden="true">
              +
            </span>
          ) : null}
          <kbd className="kg-kbd">{key}</kbd>
        </Fragment>
      ))}
    </span>
  );
}

export function Status({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "accent" | "danger";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("kg-status", `kg-status-${tone}`, className)}>
      <span className="kg-status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** 区画の見出し。ラベル＋件数、右に補足、下に hairline */
export function SectionHead({
  children,
  count,
  aside,
  as: Tag = "h2",
  className,
  id,
}: {
  children: ReactNode;
  count?: number | string;
  aside?: ReactNode;
  as?: "h2" | "h3" | "h4" | "div";
  className?: string;
  id?: string;
}) {
  return (
    <div className={cx("kg-sh", className)}>
      <Tag className="kg-sh-label" id={id}>
        {children}
        {count != null ? <span className="kg-sh-count">{count}</span> : null}
      </Tag>
      {aside ? <span className="kg-sh-aside">{aside}</span> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("kg-empty", className)}>
      <p className="kg-empty-title">{title}</p>
      {description ? <p className="kg-empty-desc">{description}</p> : null}
      {action ? <div className="kg-empty-action">{action}</div> : null}
    </div>
  );
}

export function Separator({
  vertical,
  label,
  className,
}: {
  vertical?: boolean;
  label?: ReactNode;
  className?: string;
}) {
  if (label) {
    return (
      <div className={cx("kg-sep-label", className)}>
        <span>{label}</span>
      </div>
    );
  }
  return (
    <hr
      className={cx("kg-sep", vertical && "is-vertical", className)}
      aria-orientation={vertical ? "vertical" : undefined}
    />
  );
}

export function Skeleton({
  lines = 1,
  width,
  height = 12,
  className,
}: {
  lines?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  const rows = Array.from({ length: lines }, (_, i) => ({
    id: `line-${i}`,
    width: i === lines - 1 && lines > 1 ? "60%" : (width ?? "100%"),
  }));
  return (
    <span className={cx("kg-skel-group", className)} aria-hidden="true">
      {rows.map((row) => (
        <span key={row.id} className="kg-skel" style={{ width: row.width, height }} />
      ))}
    </span>
  );
}

export interface MetaItem {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

/** 項目名と値の対 */
export function Meta({ items, className }: { items: MetaItem[]; className?: string }) {
  return (
    <dl className={cx("kg-meta", className)}>
      {items.map((item) => (
        <Fragment key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.mono ? "is-mono" : undefined}>{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
