import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ZipGame from "./Game.tsx";

const props = () => ({
  mode: "normal",
  paused: false,
  seed: 7,
  sound: { play: vi.fn() },
  reducedMotion: true,
  onHud: vi.fn(),
  onFinish: vi.fn(),
});

describe("ZipGame", () => {
  it("starts on the first board and reports the stage and time", () => {
    const p = props();
    render(<ZipGame {...p} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/1 面目。次は 2。残り 15 マス/);
    expect(p.onHud).toHaveBeenCalledWith([
      { label: "面", value: "1 / 5" },
      { label: "時間", value: "0:00.0" },
    ]);
  });

  it("extends the path with the arrow keys and undoes with Backspace", async () => {
    render(<ZipGame {...props()} />);
    const board = screen.getByRole("img");
    for (const key of ["{ArrowUp}", "{ArrowDown}", "{ArrowLeft}", "{ArrowRight}"]) {
      await userEvent.keyboard(key);
      if (!board.getAttribute("aria-label")?.includes("残り 15 マス")) break;
    }
    expect(board).toHaveAccessibleName(/残り 14 マス/);
    await userEvent.keyboard("{Backspace}");
    expect(board).toHaveAccessibleName(/残り 15 マス/);
  });

  it("ignores keys while paused", async () => {
    render(<ZipGame {...props()} paused />);
    await userEvent.keyboard("{ArrowUp}{ArrowDown}{ArrowLeft}{ArrowRight}");
    expect(screen.getByRole("img")).toHaveAccessibleName(/残り 15 マス/);
  });
});
