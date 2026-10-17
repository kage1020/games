import { lazy } from "react";
import type { GameDefinition } from "@/sdk/types.ts";
import { Thumb } from "./Thumb.tsx";

export const breakout: GameDefinition = {
  id: "breakout",
  title: "ブロック崩し",
  summary: "ボールを打ち返してブロックを崩す",
  description:
    "パドルを動かしてボールを打ち返し、上のブロックを崩す。パドルの端で返すほど斜めに飛ぶ。ブロックをすべて崩すと次の面に進み、ボールが少し速くなる。ボールを 3 回落とすとおしまい。",
  genre: "アクション",
  players: "1人",
  duration: "3分",
  aspect: "square",
  timed: true,
  modes: [{ id: "normal", label: "ふつう" }],
  score: { label: "崩した数", format: (score) => String(score) },
  controls: [
    { keys: ["←", "→"], text: "で動かす" },
    { keys: ["Space"], text: "で打ち出す" },
    { text: "指やマウスでも動かせる" },
  ],
  Thumb,
  Game: lazy(() => import("./Game.tsx")),
};
