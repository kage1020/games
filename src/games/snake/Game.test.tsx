import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SnakeGame from "./Game.tsx";

const props = () => ({
  mode: "normal",
  seed: 1,
  sound: { play: vi.fn() },
  reducedMotion: false,
  onHud: vi.fn(),
  onFinish: vi.fn(),
  saved: null,
  onSave: vi.fn(),
});

describe("SnakeGame", () => {
  it("reports the HUD and draws the board", () => {
    const p = props();
    render(<SnakeGame {...p} paused={false} />);
    expect(screen.getByRole("img", { name: /長さ 3/ })).toBeInTheDocument();
    expect(p.onHud).toHaveBeenCalledWith([
      { label: "長さ", value: "3" },
      { label: "食べた数", value: "0" },
    ]);
  });

  it("does not move while paused", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const p = props();
    render(<SnakeGame {...p} paused />);
    const before = screen.getByRole("img").innerHTML;
    await userEvent.keyboard("{ArrowUp}");
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("img").innerHTML).toBe(before);
    vi.useRealTimers();
  });
});
