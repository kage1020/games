import { lazy } from "react";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const snake: GameDefinition = {
  id: "snake",
  title: "スネーク",
  summary: "伸びながらエサを集める",
  description:
    "ヘビを動かしてエサを食べる。食べるたびに 1 マス伸び、少しずつ速くなる。壁か自分の体に当たると終わる。",
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
    { text: "スワイプでも曲がる" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
