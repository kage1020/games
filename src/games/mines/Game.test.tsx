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

describe("MinesGame long press", () => {
  const FLAG = 'path[d^="M40 24 L72"]';
  const setup = () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const p = props();
    const view = render(<MinesGame {...p} mode="infinite" />);
    const svg = screen.getByRole("img");
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 550, height: 550 });
    svg.setPointerCapture = vi.fn();
    return { p, svg, container: view.container };
  };
  /** 画面の 11×11 マスのうち、左上から (column, row) 番目のマスの中央 */
  const at = (column: number, row: number) => ({
    clientX: column * 50 + 25,
    clientY: row * 50 + 25,
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-G-mines-12 traces the press on the cell until it becomes a flag", () => {
    const { p, svg, container } = setup();
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, ...at(5, 5) });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
    expect(container.querySelectorAll(FLAG)).toHaveLength(1);
    fireEvent.pointerUp(svg, { pointerId: 1, ...at(5, 5) });
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "開いたマス", value: "0" },
      { label: "時間", value: "0:00.0" },
    ]);
  });

  it("AC-G-mines-12 clears the trace when released early or dragged", () => {
    const { svg, container } = setup();
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, ...at(5, 5) });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at(5, 5) });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);

    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, ...at(1, 1) });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(1);
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 120, clientY: 75 });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
  });

  it("AC-G-mines-13 plays the flag sound for flags and stays quiet on an opened cell", () => {
    const { p, svg, container } = setup();
    act(() => {
      fireEvent.keyDown(window, { key: " " });
    });
    const board = reveal(createInfinite(p.seed), 0, 0);
    const closed = Array.from({ length: 121 }, (_, i) => ({
      column: i % 11,
      row: Math.floor(i / 11),
    })).find(({ column, row }) => !board.revealed.has(`${column - 5},${row - 5}`));
    if (!closed) throw new Error("画面に閉じたマスがない");
    fireEvent.pointerDown(svg, { pointerId: 1, button: 2, ...at(closed.column, closed.row) });
    expect(p.sound.play).toHaveBeenLastCalledWith("flag");
    expect(container.querySelectorAll(FLAG)).toHaveLength(1);

    p.sound.play.mockClear();
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, ...at(5, 5) });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.pointerUp(svg, { pointerId: 1, ...at(5, 5) });
    act(() => {
      fireEvent.keyDown(window, { key: "f" });
    });
    expect(p.sound.play).not.toHaveBeenCalledWith("flag");
  });
});
