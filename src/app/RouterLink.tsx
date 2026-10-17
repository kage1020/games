import { Link } from "react-router";
import type { LinkProps } from "@/design-system/index.ts";

/** デザインシステムの部品が描くリンクを、サイト内ならルーターで移る */
export function RouterLink({ href, ...rest }: LinkProps) {
  if (/^[a-z]+:/i.test(href) || href.startsWith("//")) return <a href={href} {...rest} />;
  return <Link to={href} {...rest} />;
}
