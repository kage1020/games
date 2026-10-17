import { type AnchorHTMLAttributes, type ComponentType, createContext, useContext } from "react";

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const PlainLink: ComponentType<LinkProps> = (props) => <a {...props} />;

const LinkContext = createContext<ComponentType<LinkProps>>(PlainLink);

/** href を持つ部品がどのリンクで描くかを、アプリ（ルーター）が決める */
export const LinkProvider = LinkContext.Provider;

export function useLinkComponent(): ComponentType<LinkProps> {
  return useContext(LinkContext);
}
