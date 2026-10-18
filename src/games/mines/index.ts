import { lazy } from "react";
import { durationDelta, formatDuration, formatNumber } from "@/platform/format.ts";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const mines: GameDefinition = {
  id: "mines",
  title: "マインスイーパー",
  summary: "数字を手がかりに、地雷を避けて開く",
  description:
    "数字は周り 8 マスにある地雷の数。地雷のないマスをすべて開くまでの時間を競う。無限は盤面に端がなく、地雷を踏むまでに開いたマスの数を競う。開拓は端のない盤面を 8×8 の区画に分け、確保した区画の数を競う。踏んでもその区画を失うだけで、終えるときは自分で決める。最初に開くマスとその周りには地雷がない。",
  genre: "パズル",
  players: "1人",
  duration: "5分",
  aspect: "square",
  timed: true,
  modes: [
    { id: "easy", label: "初級" },
    { id: "normal", label: "中級" },
    {
      id: "infinite",
      label: "無限",
      fill: true,
      score: {
        label: "開いたマス",
        format: formatNumber,
        delta: (diff) => ({ value: diff, unit: "マス" }),
      },
    },
    {
      id: "frontier",
      label: "開拓",
      fill: true,
      score: {
        label: "確保した区画",
        format: formatNumber,
        delta: (diff) => ({ value: diff, unit: "区画" }),
      },
    },
  ],
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
    { text: "無限・開拓ではドラッグで動かし、ピンチかホイールで拡大・縮小" },
    { keys: ["+", "-"], text: "で拡大・縮小（無限・開拓）" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
