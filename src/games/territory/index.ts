import { lazy } from "react";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const territory: GameDefinition = {
  id: "territory",
  title: "陣取り",
  summary: "マスを塗って広げる",
  description:
    "通ったマスが自分のものになる。自分のマスでぐるりと囲んだマスもまとめて取れる。P1 があなたで、ほかは CPU。60 秒でいちばん多く持っていた人の勝ち。",
  genre: "アクション",
  players: "2〜4人",
  duration: "1分",
  aspect: "wide",
  timed: true,
  modes: [
    { id: "p2", label: "2人" },
    { id: "p3", label: "3人" },
    { id: "p4", label: "4人" },
  ],
  modeLabel: "人数",
  scoreLabel: "自分のマス",
  formatScore: (score) => `${score}`,
  controls: [
    { keys: ["←", "→", "↑", "↓"], text: "で向きを変える" },
    { text: "画面を払っても曲がる" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
