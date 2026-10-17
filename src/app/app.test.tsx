import type { MeResponse, RankingResponse, ScoreResponse } from "@shared/api.ts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { GAMES } from "@/games/registry.ts";
import { identityStore } from "@/platform/identity.ts";
import { type ApiClient, ApiRequestError } from "@/platform/ranking/client.ts";
import { ApiProvider } from "@/platform/ranking/context.tsx";
import { recordsStore } from "@/platform/records/store.ts";
import { settingsStore } from "@/platform/settings.ts";
import type { GameDefinition, GameProps } from "@/sdk/types.ts";
import { mediaMatches } from "../test-setup.ts";
import { GamesProvider } from "./games-context.tsx";
import { routes } from "./routes.tsx";

const RANKS = {
  today: { rank: 1, total: 1 },
  week: { rank: 3, total: 9 },
  all: { rank: 5, total: 20 },
};

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    submitScore: vi.fn(async (): Promise<ScoreResponse> => ({ best: 10, ranks: RANKS })),
    getRanking: vi.fn(
      async (): Promise<RankingResponse> => ({
        rows: [{ rank: 1, name: "Sora", score: 18, me: false }],
        me: null,
        total: 1,
      }),
    ),
    getMe: vi.fn(async (): Promise<MeResponse> => ({ name: "Mina", bests: [] })),
    putName: vi.fn(async (_code: string, name: string) => ({ name })),
    ...overrides,
  };
}

let finishGame: ((score: number | null) => void) | null = null;

function FakeGame({ paused, onFinish }: GameProps) {
  finishGame = (score) => onFinish({ score });
  return <p>{paused ? "止まっている" : "動いている"}</p>;
}

function fakeGame(overrides: Partial<GameDefinition>): GameDefinition {
  return {
    id: "snake",
    title: "蛇",
    summary: "伸びながら餌を集める",
    description: "餌を食べると伸びる。",
    genre: "アクション",
    players: "1人",
    duration: "3分",
    aspect: "square",
    timed: true,
    modes: [{ id: "normal", label: "ふつう" }],
    scoreLabel: "食べた数",
    formatScore: (score) => String(score),
    controls: [{ keys: ["←"], text: "で曲がる" }],
    Thumb: () => <svg aria-hidden="true" />,
    Game: FakeGame,
    ...overrides,
  };
}

function renderApp(path: string, options: { api?: ApiClient; games?: GameDefinition[] } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const api = options.api ?? fakeApi();
  const utils = render(
    <ApiProvider value={api}>
      <GamesProvider value={options.games ?? GAMES}>
        <RouterProvider router={router} />
      </GamesProvider>
    </ApiProvider>,
  );
  return { ...utils, router, api };
}

async function startGame() {
  await userEvent.click(await screen.findByRole("button", { name: "はじめる" }));
  await screen.findByText("動いている");
}

describe("home", () => {
  it("AC-U5 lists eight games and filters them by genre", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "8 つのゲーム" }),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(8);
    await userEvent.click(screen.getByRole("radio", { name: "パズル" }));
    const puzzles = GAMES.filter((game) => game.genre === "パズル");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      `${puzzles.length} つのゲーム`,
    );
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(puzzles.length);
  });

  it("AC-U6 puts favorites first", async () => {
    const last = GAMES.at(-1);
    if (!last) throw new Error("no games");
    settingsStore.set((current) => ({ ...current, favorites: [last.id] }));
    renderApp("/");
    const items = within(await screen.findByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(last.title);
    expect(items[0]).toHaveTextContent("お気に入り");
  });
});

describe("play", () => {
  it("AC-U3 pauses a timed game when the tab is hidden", async () => {
    renderApp("/snake", { games: [fakeGame({})] });
    await startGame();
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hidden.mockRestore();
    expect(screen.getByText("止まっている")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "一時停止中" })).toBeInTheDocument();
  });

  it("AC-U3 keeps an untimed game running when the tab is hidden", async () => {
    renderApp("/memory", { games: [fakeGame({ id: "memory", title: "数の記憶", timed: false })] });
    await startGame();
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hidden.mockRestore();
    expect(screen.getByText("動いている")).toBeInTheDocument();
  });

  it("AC-U7 shows the result with もう一度 focused, and Enter starts again", async () => {
    mediaMatches.set("(prefers-reduced-motion: reduce)", true);
    const api = fakeApi();
    renderApp("/snake", { games: [fakeGame({})], api });
    await startGame();
    await act(async () => finishGame?.(12));
    expect(await screen.findByText("はじめての記録。")).toBeInTheDocument();
    const again = screen.getByRole("button", { name: "もう一度" });
    expect(again).toHaveFocus();
    await waitFor(() => expect(api.submitScore).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("今週の順位")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("動いている")).toBeInTheDocument();
    expect(recordsStore.get().snake?.normal?.best).toBe(12);
  });

  it("AC-U8 tells when the ranking cannot be loaded and offers to retry", async () => {
    const getRanking = vi
      .fn<ApiClient["getRanking"]>()
      .mockRejectedValueOnce(new ApiRequestError("network"))
      .mockResolvedValue({ rows: [], me: null, total: 0 });
    renderApp("/snake", { games: [fakeGame({})], api: fakeApi({ getRanking }) });
    expect(await screen.findByRole("alert")).toHaveTextContent("ランキングを読み込めなかった。");
    await userEvent.click(screen.getByRole("button", { name: "読み込み直す" }));
    expect(await screen.findByText("まだ記録がない。")).toBeInTheDocument();
  });
});

describe("settings", () => {
  it("AC-U9 applies the theme to <html data-theme> and follows the system for 端末に合わせる", async () => {
    mediaMatches.set("(prefers-color-scheme: dark)", true);
    renderApp("/settings");
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    await userEvent.click(screen.getByRole("radio", { name: "ライト" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(settingsStore.get().theme).toBe("light");
  });

  it("AC-U10 saves the name on blur and undoes it from the notice", async () => {
    const api = fakeApi();
    renderApp("/settings", { api });
    const input = await screen.findByRole("textbox", { name: "名前" });
    await userEvent.type(input, "  ｍｉｎａ ");
    await userEvent.tab();
    expect(settingsStore.get().name).toBe("mina");
    expect(await screen.findByText("名前を「mina」にした。")).toBeInTheDocument();
    await waitFor(() => expect(api.putName).toHaveBeenCalledWith(expect.any(String), "mina"));
    await userEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(settingsStore.get().name).toBeNull();
  });

  it("AC-U11 takes over a code after the server confirms it and imports bests", async () => {
    const code = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const getMe = vi.fn<ApiClient["getMe"]>(async () => ({
      name: "Mina",
      bests: [{ game: "memory", mode: "normal", best: 14, plays: 6 }],
    }));
    renderApp("/settings", { api: fakeApi({ getMe }) });
    const field = await screen.findByRole("textbox", { name: "別の端末のコード" });
    await userEvent.type(field, code.toLowerCase());
    await userEvent.click(screen.getByRole("button", { name: "引き継ぐ" }));
    expect(await screen.findByText("記録を引き継いだ。")).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledWith(code);
    expect(identityStore.get()).toBe(code);
    expect(recordsStore.get().memory?.normal).toMatchObject({ best: 14, plays: 6 });
    expect(settingsStore.get().name).toBe("Mina");
  });

  it("AC-U11 explains an unknown code without replacing the current one", async () => {
    const getMe = vi.fn<ApiClient["getMe"]>(async () => {
      throw new ApiRequestError("not_found");
    });
    renderApp("/settings", { api: fakeApi({ getMe }) });
    const before = identityStore.get();
    const field = await screen.findByRole("textbox", { name: "別の端末のコード" });
    await userEvent.type(field, "0123456789ABCDEFGHJKMNPQRSTVWXYZ");
    await userEvent.click(screen.getByRole("button", { name: "引き継ぐ" }));
    expect(await screen.findByText(/このコードの記録が見つからない。/)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(identityStore.get()).toBe(before);
  });
});
