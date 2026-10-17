import { useEffect } from "react";
import { Outlet, type RouteObject, ScrollRestoration } from "react-router";
import { LinkProvider } from "@/design-system/index.ts";
import { HomePage } from "@/pages/HomePage.tsx";
import { NotFoundPage } from "@/pages/NotFoundPage.tsx";
import { PlayPage } from "@/pages/play/PlayPage.tsx";
import { SettingsPage } from "@/pages/SettingsPage.tsx";
import { NoticeArea } from "@/platform/notices.tsx";
import { useApi } from "@/platform/ranking/context.tsx";
import { flushPending } from "@/platform/ranking/submit.ts";
import { useApplyTheme } from "@/platform/theme.ts";
import { RouterLink } from "./RouterLink.tsx";
import { SiteHeader } from "./SiteHeader.tsx";

/** 送信待ちの記録を、開いたときと通信が戻ったときに送る */
function useFlushPending() {
  const api = useApi();
  useEffect(() => {
    const flush = () => void flushPending(api);
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [api]);
}

function RootLayout() {
  useApplyTheme();
  useFlushPending();
  return (
    <LinkProvider value={RouterLink}>
      <SiteHeader />
      <Outlet />
      <NoticeArea />
      <ScrollRestoration />
    </LinkProvider>
  );
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: ":gameId", element: <PlayPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
