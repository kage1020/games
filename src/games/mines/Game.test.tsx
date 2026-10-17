import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import MinesGame from "./Game.tsx";
import { createInfinite, isMine, reveal } from "./infinite.ts";

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

describe("MinesGame infinite", () => {
  const viewBoxX = (svg: Element) => Number(svg.getAttribute("viewBox")?.split(" ")[0]);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-G-mines-11 reports opened cells and time, and opens from the keyboard", () => {
    const p = props();
    render(<MinesGame {...p} mode="infinite" />);
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "開いたマス", value: "0" },
      { label: "時間", value: "0:00.0" },
    ]);
    act(() => {
      fireEvent.keyDown(window, { key: " " });
    });
    const shown: string = p.onHud.mock.lastCall?.[0]?.[0]?.value;
    expect(Number(shown.replace(/,/g, ""))).toBeGreaterThanOrEqual(9);
    expect(screen.getByRole("img")).toHaveAccessibleName(`開いたマス ${shown}`);
  });

  it("AC-G-mines-11 follows the cursor past the edge of the view", () => {
    render(<MinesGame {...props()} mode="infinite" />);
    const svg = screen.getByRole("img");
    const start = viewBoxX(svg);
    act(() => {
      for (let i = 0; i < 8; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(viewBoxX(svg)).toBeGreaterThan(start);
  });

  it("AC-G-mines-11 pans by dragging without opening a cell", () => {
    const p = props();
    render(<MinesGame {...p} mode="infinite" />);
    const svg = screen.getByRole("img");
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 550, height: 550 });
    svg.setPointerCapture = vi.fn();
    svg.releasePointerCapture = vi.fn();
    const start = viewBoxX(svg);
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 200, clientY: 300 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 200, clientY: 300 });
    expect(viewBoxX(svg)).toBe(start + 200);
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "開いたマス", value: "0" },
      { label: "時間", value: "0:00.0" },
    ]);
  });

  it("AC-G-mines-10 finishes on a mine with the opened count as the score", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const p = props();
    render(<MinesGame {...p} mode="infinite" />);
    act(() => {
      fireEvent.keyDown(window, { key: " " });
    });
    const opened = Number(p.onHud.mock.lastCall?.[0]?.[0]?.value.replace(/,/g, ""));
    const board = reveal(createInfinite(p.seed), 0, 0);
    const mineX = (() => {
      for (let x = 2; ; x++) if (isMine(board, x, 0)) return x;
    })();
    act(() => {
      for (let i = 0; i < mineX; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
      fireEvent.keyDown(window, { key: " " });
    });
    expect(screen.getByRole("img")).toHaveAccessibleName("地雷を踏んだ");
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(p.onFinish).toHaveBeenCalledTimes(1);
    expect(p.onFinish.mock.calls[0]?.[0]).toMatchObject({ score: opened });
  });
});
