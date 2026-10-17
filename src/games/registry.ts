import type { GameDefinition } from "@/sdk/types.ts";
import { breakout } from "./breakout/index.ts";
import { memory } from "./memory/index.ts";
import { mines } from "./mines/index.ts";
import { reaction } from "./reaction/index.ts";
import { snake } from "./snake/index.ts";
import { stack } from "./stack/index.ts";
import { territory } from "./territory/index.ts";
import { zip } from "./zip/index.ts";

/** 一覧に並ぶ順 */
export const GAMES: GameDefinition[] = [
  zip,
  snake,
  memory,
  territory,
  stack,
  mines,
  reaction,
  breakout,
];
