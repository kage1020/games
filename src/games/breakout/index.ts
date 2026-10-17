import { lazy } from "react";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const breakout: GameDefinition = {
  id: "breakout",
  title: "壁崩し",
  summary: "板で球を返して壁を崩す",
  description:
    "板を動かして球を打ち返し、上の壁を崩す。板の端で返すほど斜めに飛ぶ。壁を崩しきると次の壁が出て、球が少し速くなる。球を 3 つ落とすとおしまい。",
  genre: "アクション",
  players: "1人",
  duration: "3分",
  aspect: "square",
  timed: true,
  modes: [{ id: "normal", label: "ふつう" }],
  scoreLabel: "崩した数",
  formatScore: (score) => String(score),
  controls: [
    { keys: ["←", "→"], text: "で動かす" },
    { keys: ["Space"], text: "で打ち出す" },
    { text: "指やマウスでも動かせる" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
