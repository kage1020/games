import { lazy } from "react";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const stack: GameDefinition = {
  id: "stack",
  title: "積み木",
  summary: "動く板を止めて高く積む",
  description:
    "左右に動く板を、下の段に重なるところで止める。はみ出した分は切り落とされ、重ならなければおしまい。ぴったり止めると幅がそのまま残る。",
  genre: "アクション",
  players: "1人",
  duration: "1分",
  aspect: "tall",
  timed: true,
  modes: [{ id: "normal", label: "ふつう" }],
  scoreLabel: "積んだ段",
  formatScore: (score) => String(score),
  controls: [{ keys: ["Space"], text: "で止める" }, { text: "画面を押しても止まる" }],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
