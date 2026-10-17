import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TerritoryGame from "./Game.tsx";

describe("TerritoryGame", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows every player in the legend and reports the HUD", () => {
    const onHud = vi.fn();
    render(
      <TerritoryGame
        mode="p3"
        seed={1}
        paused={false}
        sound={{ play: vi.fn() }}
        reducedMotion={false}
        onHud={onHud}
        onFinish={vi.fn()}
      />,
    );
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("P3")).toBeInTheDocument();
    expect(screen.queryByText("P4")).not.toBeInTheDocument();
    expect(onHud).toHaveBeenCalledWith([
      { label: "あなた", value: "4" },
      { label: "残り", value: "1:00" },
    ]);
  });

  // 70 秒ぶんのフレームを jsdom で描くので、既定の 5 秒では足りないことがある
  it("finishes once after 60 seconds of play", { timeout: 20_000 }, async () => {
    vi.useFakeTimers({
      toFake: [
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
        "setTimeout",
        "clearTimeout",
      ],
    });
    const onFinish = vi.fn();
    render(
      <TerritoryGame
        mode="p2"
        seed={2}
        paused={false}
        sound={{ play: vi.fn() }}
        reducedMotion={false}
        onHud={vi.fn()}
        onFinish={onFinish}
      />,
    );
    for (let i = 0; i < 70; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0]).toMatchObject({ score: expect.any(Number) });
  });
});
