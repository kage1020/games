import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resizeElement } from "../../test-setup.ts";
import {
  createFrontier,
  type FrontierState,
  reveal as revealFrontier,
  SECTOR,
  tick as tickFrontier,
} from "./frontier.ts";
import MinesGame from "./Game.tsx";
import { cellKey, createInfinite, isMine, reveal, tick } from "./infinite.ts";
import { restoreFrontier, restoreProgress, saveFrontier, saveProgress } from "./infiniteSave.ts";

const props = () => ({
  mode: "easy",
  paused: false,
  seed: 11,
  sound: { play: vi.fn() },
  reducedMotion: true,
  onHud: vi.fn(),
  onFinish: vi.fn(),
  saved: null as unknown,
  onSave: vi.fn(),
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
  const viewBoxWidth = (svg: Element) => Number(svg.getAttribute("viewBox")?.split(" ")[2]);
  const nextFrame = () =>
    act(() => {
      vi.advanceTimersToNextFrame();
    });

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
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame"] });
    const p = props();
    render(<MinesGame {...p} mode="infinite" />);
    const svg = screen.getByRole("img");
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 550, height: 550 });
    svg.setPointerCapture = vi.fn();
    const start = viewBoxX(svg);
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 200, clientY: 300 });
    nextFrame();
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 200, clientY: 300 });
    expect(viewBoxX(svg)).toBe(start + 200);
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "開いたマス", value: "0" },
      { label: "時間", value: "0:00.0" },
    ]);
  });

  it("AC-G-mines-14 zooms with + and - around the cursor within 6 to 40 cells", () => {
    render(<MinesGame {...props()} mode="infinite" />);
    const svg = screen.getByRole("img");
    expect(viewBoxWidth(svg)).toBe(1100);
    act(() => {
      fireEvent.keyDown(window, { key: "+" });
    });
    expect(viewBoxWidth(svg)).toBeLessThan(1100);
    act(() => {
      for (let i = 0; i < 20; i++) fireEvent.keyDown(window, { key: "+" });
    });
    expect(viewBoxWidth(svg)).toBe(600);
    act(() => {
      for (let i = 0; i < 40; i++) fireEvent.keyDown(window, { key: "-" });
    });
    expect(viewBoxWidth(svg)).toBe(4000);
    const [x = 0, , width = 0] = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);
    expect(x + width / 2).toBeCloseTo(50);
  });

  it("AC-G-mines-14 zooms with the wheel around the pointed position", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    render(<MinesGame {...props()} mode="infinite" />);
    const svg = screen.getByRole("img");
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 550, height: 550 });
    const pointed = () => {
      const [x = 0, y = 0, width = 0] = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);
      return { x: x + (width * 100) / 550, y: y + (width * 400) / 550 };
    };
    const before = pointed();
    fireEvent.wheel(svg, { deltaY: 300, clientX: 100, clientY: 400 });
    nextFrame();
    expect(viewBoxWidth(svg)).toBeGreaterThan(1100);
    expect(pointed().x).toBeCloseTo(before.x);
    expect(pointed().y).toBeCloseTo(before.y);
  });

  it("AC-G-mines-14 pinches to zoom without opening or flagging", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame"] });
    const p = props();
    const { container } = render(<MinesGame {...p} mode="infinite" />);
    const svg = screen.getByRole("img");
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 550, height: 550 });
    svg.setPointerCapture = vi.fn();
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 200, clientY: 275 });
    fireEvent.pointerDown(svg, { pointerId: 2, button: 0, clientX: 350, clientY: 275 });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: 450, clientY: 275 });
    nextFrame();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(svg, { pointerId: 2, clientX: 450, clientY: 275 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 200, clientY: 275 });
    expect(viewBoxWidth(svg)).toBeLessThan(1100);
    expect(container.querySelectorAll(".mines-flag")).toHaveLength(0);
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "開いたマス", value: "0" },
      { label: "時間", value: "0:00.0" },
    ]);
  });

  it("AC-G-mines-15 draws closed cells as one pattern however far it zooms out", () => {
    const { container } = render(<MinesGame {...props()} mode="infinite" />);
    const svg = screen.getByRole("img");
    act(() => {
      for (let i = 0; i < 40; i++) fireEvent.keyDown(window, { key: "-" });
    });
    expect(viewBoxWidth(svg)).toBe(4000);
    expect(container.querySelectorAll("svg *").length).toBeLessThan(20);
    act(() => {
      fireEvent.keyDown(window, { key: " " });
    });
    const numbers = container.querySelectorAll("text").length;
    expect(numbers).toBeGreaterThan(0);
    expect(container.querySelectorAll("svg *").length).toBeLessThan(numbers + 20);
  });

  it("AC-G-mines-16 fills the shape of the screen, keeping the middle and the shorter side", () => {
    render(<MinesGame {...props()} mode="infinite" />);
    const svg = screen.getByRole("img");
    const box = () => (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);
    expect(box()).toEqual([-500, -500, 1100, 1100]);
    act(() => resizeElement(svg, 1600, 800));
    expect(box()).toEqual([-1050, -500, 2200, 1100]);
    act(() => resizeElement(svg, 400, 800));
    expect(box()).toEqual([-500, -1050, 1100, 2200]);
    act(() => resizeElement(svg, 0, 0));
    expect(box()).toEqual([-500, -1050, 1100, 2200]);
  });

  it("AC-G-mines-16 maps a press anywhere on a wide screen to the cell under it", () => {
    const { container } = render(<MinesGame {...props()} mode="infinite" />);
    const svg = screen.getByRole("img");
    svg.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 1600, height: 800 });
    act(() => resizeElement(svg, 1600, 800));
    fireEvent.pointerDown(svg, { pointerId: 1, button: 2, clientX: 1590, clientY: 10 });
    fireEvent.pointerDown(svg, { pointerId: 1, button: 2, clientX: 5, clientY: 795 });
    const flags = [...container.querySelectorAll(".mines-flag")].map((flag) => [
      Number(flag.getAttribute("x")),
      Number(flag.getAttribute("y")),
    ]);
    expect(flags).toEqual(
      expect.arrayContaining([
        [1100, -500],
        [-1100, 500],
      ]),
    );
  });

  it("AC-G-mines-16 keeps the cursor in view along the longer side", () => {
    render(<MinesGame {...props()} mode="infinite" />);
    const svg = screen.getByRole("img");
    act(() => resizeElement(svg, 1600, 800));
    act(() => {
      for (let i = 0; i < 9; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(viewBoxX(svg)).toBe(-1050);
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(viewBoxX(svg)).toBe(-1000);
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

describe("MinesGame infinite autosave", () => {
  type Props = ReturnType<typeof props>;
  const lastSave = (p: Props) => p.onSave.mock.lastCall?.[0];
  const lastProgress = (p: Props) => restoreProgress(lastSave(p)?.state);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-G-mines-17 saves from the first open on, whenever cells or flags change", () => {
    const p = props();
    render(<MinesGame {...p} mode="infinite" />);
    expect(p.onSave).not.toHaveBeenCalled();
    act(() => {
      fireEvent.keyDown(window, { key: " " });
    });
    const board = reveal(createInfinite(p.seed), 0, 0);
    expect(lastSave(p)?.summary).toEqual([
      { label: "開いたマス", value: String(board.revealed.size) },
      { label: "時間", value: "0:00.0" },
    ]);
    expect(lastProgress(p)?.game.revealed).toEqual(board.revealed);

    const closed = [...Array(30).keys()].find((x) => !board.revealed.has(cellKey(x, 0)));
    if (closed === undefined) throw new Error("閉じたマスがない");
    act(() => {
      for (let i = 0; i < closed; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    act(() => {
      fireEvent.keyDown(window, { key: "f" });
    });
    expect(lastProgress(p)?.game.flagged.has(cellKey(closed, 0))).toBe(true);
    expect(lastProgress(p)?.cursor).toEqual({ x: closed, y: 0 });
  });

  it("AC-G-mines-17 saves when paused, when the page hides and when it leaves the screen", () => {
    const p = props();
    const { rerender, unmount } = render(<MinesGame {...p} mode="infinite" />);
    act(() => {
      fireEvent.keyDown(window, { key: " " });
    });
    p.onSave.mockClear();
    rerender(<MinesGame {...p} mode="infinite" paused />);
    expect(p.onSave).toHaveBeenCalledTimes(1);

    p.onSave.mockClear();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(p.onSave).toHaveBeenCalledTimes(1);

    rerender(<MinesGame {...p} mode="infinite" />);
    act(() => {
      fireEvent.keyDown(window, { key: "+" });
    });
    p.onSave.mockClear();
    unmount();
    expect(p.onSave).toHaveBeenCalledTimes(1);
    expect(lastProgress(p)?.span).toBeLessThan(11);
  });

  it("AC-G-mines-17 drops the save as soon as a mine opens", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const p = props();
    const { unmount } = render(<MinesGame {...p} mode="infinite" />);
    act(() => {
      fireEvent.keyDown(window, { key: " " });
    });
    const board = reveal(createInfinite(p.seed), 0, 0);
    const mineX = (() => {
      for (let x = 2; ; x++) if (isMine(board, x, 0)) return x;
    })();
    act(() => {
      for (let i = 0; i < mineX; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
      fireEvent.keyDown(window, { key: " " });
    });
    expect(p.onFinish).not.toHaveBeenCalled();
    expect(p.onSave).toHaveBeenLastCalledWith(null);
    unmount();
    expect(p.onSave).toHaveBeenLastCalledWith(null);
  });

  it("AC-G-mines-17 resumes the saved board, time and view", () => {
    const game = tick(reveal(createInfinite(5), 0, 0), 90_000);
    const saved = saveProgress({
      game,
      center: { x: 2.5, y: 0.5 },
      span: 20,
      cursor: { x: 2, y: 0 },
    });
    const p = { ...props(), seed: 999, saved };
    render(<MinesGame {...p} mode="infinite" />);
    const opened = String(game.revealed.size);
    expect(screen.getByRole("img")).toHaveAccessibleName(`開いたマス ${opened}`);
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "開いたマス", value: opened },
      { label: "時間", value: "1:30.0" },
    ]);
    expect(screen.getByRole("img").getAttribute("viewBox")).toBe("-750 -950 2000 2000");
    expect(p.onSave).not.toHaveBeenCalledWith(null);
  });

  it("AC-G-mines-17 starts over and drops a save it cannot read", () => {
    const p = { ...props(), saved: { broken: true } };
    render(<MinesGame {...p} mode="infinite" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("マスを選んで開く");
    expect(p.onSave).toHaveBeenCalledWith(null);
  });
});

describe("MinesGame long press", () => {
  const FLAG = ".mines-flag";
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
    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(container.querySelectorAll(FLAG)).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
    expect(container.querySelectorAll(FLAG)).toHaveLength(1);
    fireEvent.pointerUp(svg, { pointerId: 1, ...at(5, 5) });
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "開いたマス", value: "0" },
      { label: "時間", value: "0:00.0" },
    ]);
  });

  it("AC-G-mines-12 shows no trace for a quick tap or the start of a drag", () => {
    const { svg, container } = setup();
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, ...at(5, 5) });
    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
    fireEvent.pointerUp(svg, { pointerId: 1, ...at(5, 5) });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);

    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, ...at(1, 1) });
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 120, clientY: 75 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelectorAll(".mines-press")).toHaveLength(0);
    expect(container.querySelectorAll(FLAG)).toHaveLength(0);
  });

  it("AC-G-mines-12 clears the trace when the press turns into a drag", () => {
    const { svg, container } = setup();
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, ...at(1, 1) });
    act(() => {
      vi.advanceTimersByTime(200);
    });
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

describe("MinesGame frontier", () => {
  type Props = ReturnType<typeof props>;
  const hud = (p: Props) => p.onHud.mock.lastCall?.[0];
  const lastSave = (p: Props) => p.onSave.mock.lastCall?.[0];
  const firstMineX = (seed: number) => {
    const board = reveal(createInfinite(seed), 0, 0);
    for (let x = 2; ; x++) if (isMine(board, x, 0)) return x;
  };
  const press = (key: string) =>
    act(() => {
      fireEvent.keyDown(window, { key });
    });
  const stepRight = (count: number) =>
    act(() => {
      for (let i = 0; i < count; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
      fireEvent.keyDown(window, { key: " " });
    });

  /** 区画 "0,0" の安全なマスを 1 つだけ残して開いた盤面と、残ったマス */
  function oneLeft() {
    for (let seed = 1; ; seed++) {
      let game = revealFrontier(createFrontier(seed), 3, 3);
      const closed = () => {
        const cells: { x: number; y: number }[] = [];
        for (let y = 0; y < SECTOR; y++) {
          for (let x = 0; x < SECTOR; x++) {
            if (!isMine(game, x, y) && !game.revealed.has(cellKey(x, y))) cells.push({ x, y });
          }
        }
        return cells;
      };
      for (let next = closed(); next.length > 1; next = closed()) {
        const [cell = { x: 0, y: 0 }] = next;
        game = revealFrontier(game, cell.x, cell.y);
      }
      const [last] = closed();
      if (last) return { game, last };
    }
  }
  const resumeAt = (game: FrontierState, cursor: { x: number; y: number }) =>
    saveFrontier({ game, center: { x: cursor.x + 0.5, y: cursor.y + 0.5 }, span: 11, cursor });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-G-mines-21 reports secured sectors, stepped-on mines and time, and draws sector borders", () => {
    const p = props();
    const { container } = render(<MinesGame {...p} mode="frontier" />);
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "区画", value: "0" },
      { label: "踏んだ地雷", value: "0" },
      { label: "時間", value: "0:00.0" },
    ]);
    expect(container.querySelectorAll(".mines-sectors")).toHaveLength(1);
    press(" ");
    expect(p.sound.play).toHaveBeenLastCalledWith("tap");
    expect(screen.getByRole("img")).toHaveAccessibleName("確保した区画 0、踏んだ地雷 0");
  });

  it("AC-G-mines-20 keeps playing after a mine and leaves it where it was", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const p = props();
    const { container } = render(<MinesGame {...p} mode="frontier" />);
    press(" ");
    const mineX = firstMineX(p.seed);
    stepRight(mineX);
    expect(p.sound.play).toHaveBeenLastCalledWith("bad");
    expect(hud(p)?.[1]).toEqual({ label: "踏んだ地雷", value: "1" });
    expect(container.querySelectorAll(".mines-hit")).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(p.onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole("img")).toHaveAccessibleName("確保した区画 0、踏んだ地雷 1");
    p.sound.play.mockClear();
    press("f");
    expect(p.sound.play).not.toHaveBeenCalled();
    const board = reveal(createInfinite(p.seed), 0, 0);
    let down = 1;
    while (board.revealed.has(cellKey(mineX, down))) down++;
    for (let i = 0; i < down; i++) press("ArrowDown");
    press("f");
    expect(p.sound.play).toHaveBeenLastCalledWith("flag");
  });

  it("AC-G-mines-19 secures a sector with the good sound alone and colours it", () => {
    const { game, last } = oneLeft();
    const p = { ...props(), saved: resumeAt(game, last) };
    const { container } = render(<MinesGame {...p} mode="frontier" />);
    expect(p.sound.play).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".mines-secured")).toHaveLength(0);
    press(" ");
    expect(p.sound.play.mock.calls).toEqual([["good"]]);
    expect(hud(p)?.[0]).toEqual({ label: "区画", value: String(game.secured.size + 1) });
    expect(container.querySelectorAll(".mines-secured")).toHaveLength(1);
  });

  it("AC-G-mines-22 offers to end after the first open, and holds the board while it asks", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const p = props();
    render(<MinesGame {...p} mode="frontier" />);
    expect(screen.queryByRole("button", { name: "ここで終える" })).not.toBeInTheDocument();
    press(" ");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const time = () => hud(p)?.[2]?.value;
    const before = time();
    expect(before).not.toBe("0:00.0");

    fireEvent.click(screen.getByRole("button", { name: "ここで終える" }));
    expect(screen.getByRole("dialog", { name: "ここで終える" })).toHaveTextContent(
      "確保した区画がないので、記録は残らない。この盤面は消える。",
    );
    expect(screen.getByRole("button", { name: "続ける" })).toHaveFocus();
    const saves = p.onSave.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    press("ArrowDown");
    press(" ");
    expect(time()).toBe(before);
    expect(p.onSave).toHaveBeenCalledTimes(saves);

    fireEvent.click(screen.getByRole("button", { name: "続ける" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(time()).not.toBe(before);
    expect(p.onFinish).not.toHaveBeenCalled();
  });

  it("AC-G-mines-22 ends with the secured sectors as the score and drops the save", () => {
    const { game, last } = oneLeft();
    const p = { ...props(), saved: resumeAt(game, last) };
    const { unmount } = render(<MinesGame {...p} mode="frontier" />);
    press(" ");
    const secured = game.secured.size + 1;
    fireEvent.click(screen.getByRole("button", { name: "ここで終える" }));
    expect(screen.getByRole("dialog", { name: "ここで終える" })).toHaveTextContent(
      `確保した区画 ${secured} を記録する。この盤面は消える。`,
    );
    p.onSave.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "終える" }));
    expect(p.onSave).toHaveBeenCalledWith(null);
    expect(p.onFinish).toHaveBeenCalledTimes(1);
    const [saveOrder = 0] = p.onSave.mock.invocationCallOrder;
    const [finishOrder = 0] = p.onFinish.mock.invocationCallOrder;
    expect(saveOrder).toBeLessThan(finishOrder);
    const result = p.onFinish.mock.calls[0]?.[0];
    expect(result).toMatchObject({ score: secured });
    expect(result?.stats.map((item: { label: string }) => item.label)).toEqual([
      "踏んだ地雷",
      "開いたマス",
      "時間",
    ]);
    unmount();
    expect(p.onSave).toHaveBeenLastCalledWith(null);
  });

  it("AC-G-mines-22 leaves no record when no sector is secured", () => {
    const p = props();
    render(<MinesGame {...p} mode="frontier" />);
    press(" ");
    fireEvent.click(screen.getByRole("button", { name: "ここで終える" }));
    fireEvent.click(screen.getByRole("button", { name: "終える" }));
    expect(p.onFinish.mock.calls[0]?.[0]).toMatchObject({
      score: null,
      note: "確保した区画がない。記録は残らない。",
    });
  });

  it("AC-G-mines-23 saves the stepped-on mines and keeps the save after a mine", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const p = props();
    render(<MinesGame {...p} mode="frontier" />);
    press(" ");
    expect(lastSave(p)?.summary).toEqual([
      { label: "区画", value: "0" },
      { label: "踏んだ地雷", value: "0" },
      { label: "時間", value: "0:00.0" },
    ]);
    const mineX = firstMineX(p.seed);
    stepRight(mineX);
    expect(restoreFrontier(lastSave(p)?.state)?.game.hits).toEqual(new Set([cellKey(mineX, 0)]));
    expect(lastSave(p)?.summary[1]).toEqual({ label: "踏んだ地雷", value: "1" });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(p.onSave).not.toHaveBeenCalledWith(null);
  });

  it("AC-G-mines-23 resumes the saved board with its sectors and stepped-on mines", () => {
    const { game, last } = oneLeft();
    const secured = revealFrontier(game, last.x, last.y);
    const mine = [...Array(40).keys()]
      .map((i) => ({ x: i - 20, y: -9 }))
      .find((cell) => isMine(secured, cell.x, cell.y));
    if (!mine) throw new Error("地雷がない");
    const played = tickFrontier(revealFrontier(secured, mine.x, mine.y), 75_000);
    const p = { ...props(), seed: 999, saved: resumeAt(played, mine) };
    const { container } = render(<MinesGame {...p} mode="frontier" />);
    expect(p.onHud).toHaveBeenLastCalledWith([
      { label: "区画", value: String(played.secured.size) },
      { label: "踏んだ地雷", value: "1" },
      { label: "時間", value: "1:15.0" },
    ]);
    expect(container.querySelectorAll(".mines-hit")).toHaveLength(1);
    expect(p.sound.play).not.toHaveBeenCalled();
    expect(p.onSave).not.toHaveBeenCalledWith(null);
  });

  it("AC-G-mines-23 starts over and drops a save it cannot read", () => {
    const saved = saveProgress({
      game: reveal(createInfinite(3), 0, 0),
      center: { x: 0, y: 0 },
      span: 11,
      cursor: { x: 0, y: 0 },
    });
    const p = { ...props(), saved };
    render(<MinesGame {...p} mode="frontier" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("マスを選んで開く");
    expect(p.onSave).toHaveBeenCalledWith(null);
  });
});
