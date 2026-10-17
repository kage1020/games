import { lazy } from "react";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const reaction: GameDefinition = {
  id: "reaction",
  title: "反応速度",
  summary: "合図が出たらすぐ押す",
  description:
    "画面が変わって「押す」が出たら、すぐに押す。5 回の平均の速さを測る。合図の前に押すと、その回はやり直し。",
  genre: "脳トレ",
  players: "1人",
  duration: "1分",
  aspect: "wide",
  timed: true,
  modes: [{ id: "normal", label: "ふつう" }],
  scoreLabel: "平均",
  formatScore: (score) => `${score} ms`,
  formatDelta: (diff) => ({ value: diff, unit: "ms" }),
  controls: [{ keys: ["Space"], text: "で押す" }, { text: "画面を押してもよい" }],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
