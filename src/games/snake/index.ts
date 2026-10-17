import { lazy } from "react";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const snake: GameDefinition = {
  id: "snake",
  title: "蛇",
  summary: "伸びながら餌を集める",
  description:
    "蛇を動かして餌を食べる。食べるたびに 1 つ伸び、少しずつ速くなる。壁か自分の体に当たると終わる。",
  genre: "アクション",
  players: "1人",
  duration: "3分",
  aspect: "square",
  timed: true,
  modes: [{ id: "normal", label: "ふつう" }],
  scoreLabel: "食べた数",
  formatScore: (score) => String(score),
  controls: [
    { keys: ["←", "→", "↑", "↓"], text: "で向きを変える" },
    { text: "画面を払っても曲がる" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
