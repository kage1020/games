import { lazy } from "react";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const memory: GameDefinition = {
  id: "memory",
  title: "数字記憶",
  summary: "数字の位置を覚えて、小さい順に押す",
  description:
    "盤面に散らばった数字の位置を覚える。1 を押すと残りの数字が隠れるので、2 から順に押していく。クリアするたびに数字が 1 つ増え、ミスは 3 回まで。",
  genre: "脳トレ",
  players: "1人",
  duration: "2分",
  aspect: "wide",
  timed: false,
  modes: [{ id: "normal", label: "ふつう" }],
  scoreLabel: "覚えた数",
  formatScore: (score) => String(score),
  controls: [
    { text: "数字を小さい順に押す" },
    { keys: ["←", "→", "↑", "↓"], text: "で選ぶ" },
    { keys: ["Space"], text: "で押す" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
