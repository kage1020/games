import type { GameDefinition, ScoreFormat } from "./types.ts";

/** モードに記録の表し方があればそれ、なければゲームの表し方 */
export function scoreFormat(
  game: Pick<GameDefinition, "score" | "modes">,
  mode: string,
): ScoreFormat {
  return game.modes.find((candidate) => candidate.id === mode)?.score ?? game.score;
}
