import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MinesGame from "./Game.tsx";

const props = () => ({
  mode: "easy",
  paused: false,
  seed: 11,
  sound: { play: vi.fn() },
  reducedMotion: true,
  onHud: vi.fn(),
  onFinish: vi.fn(),
});

describe("MinesGame", () => {
  it("reports the mines left and time", () => {
    const p = props();
    render(<MinesGame {...p} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("マスを選んで開く");
    expect(p.onHud).toHaveBeenCalledWith([
      { label: "地雷", value: "10" },
      { label: "時間", value: "0:00.0" },
    ]);
  });

  it("flags with F and opens with Space from the keyboard", async () => {
    const p = props();
    render(<MinesGame {...p} />);
    await userEvent.keyboard("{ArrowRight}f");
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "地雷", value: "9" },
      { label: "時間", value: "0:00.0" },
    ]);
    await userEvent.keyboard("{ArrowDown}{ArrowDown} ");
    expect(screen.getByRole("img")).toHaveAccessibleName("残りの地雷 9");
  });

  it("uses the 中級 board for the normal mode", () => {
    const p = props();
    const { container } = render(<MinesGame {...p} mode="normal" />);
    expect(container.querySelectorAll("g[transform]")).toHaveLength(256);
    expect(p.onHud).toHaveBeenCalledWith([
      { label: "地雷", value: "40" },
      { label: "時間", value: "0:00.0" },
    ]);
  });
});
