import { createContext, useContext } from "react";
import { GAMES } from "@/games/registry.ts";
import type { GameDefinition } from "@/sdk/types.ts";

const GamesContext = createContext<GameDefinition[]>(GAMES);

export const GamesProvider = GamesContext.Provider;

export function useGames(): GameDefinition[] {
  return useContext(GamesContext);
}

export function useGame(id: string | undefined): GameDefinition | undefined {
  return useGames().find((game) => game.id === id);
}
