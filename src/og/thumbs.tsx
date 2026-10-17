import { renderToStaticMarkup } from "react-dom/server";
import { GAMES } from "@/games/registry.ts";

/** 共有用の画像に並べる、一覧と同じサムネイル（SVG の文字列） */
export function renderThumbs(): { id: string; title: string; svg: string }[] {
  return GAMES.map((game) => ({
    id: game.id,
    title: game.title,
    svg: renderToStaticMarkup(<game.Thumb />),
  }));
}
