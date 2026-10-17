import { lazy } from "react";
import { durationDelta, formatDuration } from "@/platform/format.ts";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const mines: GameDefinition = {
  id: "mines",
  title: "マインスイーパー",
  summary: "数字を手がかりに、地雷を避けて開く",
  description:
    "数字は周り 8 マスにある地雷の数。地雷のないマスをすべて開くまでの時間を競う。最初に開くマスとその周りには地雷がない。",
  genre: "パズル",
  players: "1人",
  duration: "5分",
  aspect: "square",
  timed: true,
  modes: [
    { id: "easy", label: "初級" },
    { id: "normal", label: "中級" },
  ],
  modeLabel: "難易度",
  score: {
    label: "時間",
    format: formatDuration,
    delta: (diff) => ({ value: durationDelta(diff), unit: "秒" }),
  },
  controls: [
    { text: "押して開く" },
    { text: "長押しか右クリックで旗" },
    { keys: ["←", "→", "↑", "↓"], text: "で選ぶ" },
    { keys: ["Space"], text: "で開く" },
    { keys: ["F"], text: "で旗を立てる" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
