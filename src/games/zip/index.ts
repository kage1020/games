import { lazy } from "react";
import { durationDelta, formatDuration } from "@/platform/format.ts";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const zip: GameDefinition = {
  id: "zip",
  title: "点つなぎ",
  summary: "番号の順に、すべてのマスを一筆で通る",
  description:
    "1 から番号の順にたどり、すべてのマスを一度ずつ通る線を引く。最後の番号で終わればその面はクリア。5 面の合計時間を競う。",
  genre: "パズル",
  players: "1人",
  duration: "3分",
  aspect: "square",
  timed: true,
  modes: [{ id: "normal", label: "ふつう" }],
  scoreLabel: "時間",
  formatScore: formatDuration,
  formatDelta: (diff) => ({ value: durationDelta(diff), unit: "秒" }),
  controls: [
    { text: "ドラッグで線を引く" },
    { keys: ["←", "→", "↑", "↓"], text: "で進む" },
    { keys: ["Backspace"], text: "で戻す" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
