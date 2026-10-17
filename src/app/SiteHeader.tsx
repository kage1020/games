import { Moon, Settings2, Sun } from "lucide-react";
import { Link, useLocation } from "react-router";
import { AppBar, Button } from "@/design-system/index.ts";
import { useMediaQuery } from "@/platform/media.ts";
import { toggleTheme, useResolvedTheme } from "@/platform/theme.ts";
import { useGames } from "./games-context.tsx";
import { SITE_DOMAIN, SITE_LABEL } from "./site.ts";

export const NARROW = "(max-width: 640px)";

function SiteName() {
  return (
    <Link to="/" className="site-name">
      <span className="ui-strong">{SITE_LABEL}</span>
      <span className="code site-domain">{SITE_DOMAIN}</span>
    </Link>
  );
}

/** サイト共通の帯。狭い画面では AppBar になり、階層を下りた画面では一覧へ戻るボタンを持つ */
export function SiteHeader() {
  const theme = useResolvedTheme();
  const narrow = useMediaQuery(NARROW);
  const { pathname } = useLocation();
  const games = useGames();
  const themeLabel = theme === "dark" ? "ライトにする" : "ダークにする";
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  if (narrow) {
    const game = games.find((candidate) => `/${candidate.id}` === pathname);
    const title = game ? game.title : pathname === "/settings" ? "記録と設定" : <SiteName />;
    return (
      <AppBar
        className="site-appbar"
        titleAs="div"
        title={title}
        backHref={pathname === "/" ? undefined : "/"}
        backLabel="一覧へ"
        actions={[
          { icon: <Settings2 />, label: "記録と設定", href: "/settings" },
          { icon: <ThemeIcon />, label: themeLabel, onClick: () => toggleTheme(theme) },
        ]}
      />
    );
  }

  return (
    <header className="site-header">
      <SiteName />
      <nav className="site-actions" aria-label="サイト">
        <Button
          variant="ghost"
          size="sm"
          icon={<Settings2 />}
          aria-label="記録と設定"
          href="/settings"
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<ThemeIcon />}
          aria-label={themeLabel}
          onClick={() => toggleTheme(theme)}
        />
      </nav>
    </header>
  );
}
