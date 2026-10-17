import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode, Ref } from "react";
import { cx } from "../internal.ts";
import { useLinkComponent } from "../link.tsx";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "onClick"> {
  variant?: "outline" | "primary" | "ghost" | "link" | "danger";
  size?: "md" | "sm";
  icon?: ReactNode;
  /** 表示だけ変える。クリックは受け付け続ける */
  loading?: boolean;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  ref?: Ref<HTMLButtonElement>;
}

/** 既定は outline。disabled は作らない（押せない理由は押したときに伝える）。 */
export function Button(props: ButtonProps) {
  const {
    variant = "outline",
    size = "md",
    icon,
    loading,
    href,
    className,
    children,
    title,
    onClick,
    ...rest
  } = props;
  const { disabled: _disabled, ...buttonProps } = rest as typeof rest & { disabled?: boolean };
  const Link = useLinkComponent();
  const iconOnly = icon != null && (children == null || children === false);
  const classes = cx(
    "kg-btn",
    `kg-btn-${variant}`,
    size === "sm" && "kg-btn-sm",
    iconOnly && "kg-btn-icon",
    loading && "is-loading",
    className,
  );
  const label = buttonProps["aria-label"];
  const content = (
    <>
      {icon ? (
        <span className="kg-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {iconOnly ? null : children}
      {loading ? (
        <span className="kg-btn-busy" aria-hidden="true">
          …
        </span>
      ) : null}
    </>
  );
  if (href !== undefined) {
    return (
      <Link
        href={href}
        className={classes}
        title={title ?? (iconOnly ? label : undefined)}
        aria-label={label}
        aria-busy={loading || undefined}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      {...buttonProps}
      className={classes}
      title={title ?? (iconOnly ? label : undefined)}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
