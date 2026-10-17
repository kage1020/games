import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { mediaMatches } from "../test-setup.ts";
import { Button, Result, Stage } from "./index.ts";

describe("Button", () => {
  it("AC-U1 stays pressable even when disabled is passed", async () => {
    const onClick = vi.fn();
    render(
      <Button {...({ disabled: true } as object)} onClick={onClick}>
        保存
      </Button>,
    );
    const button = screen.getByRole("button", { name: "保存" });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("AC-U1 marks loading as busy without blocking clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        送信
      </Button>,
    );
    const button = screen.getByRole("button", { name: /送信/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

function PausableStage({ onPause, onResume }: { onPause: () => void; onResume: () => void }) {
  const [paused, setPaused] = useState(false);
  return (
    <Stage
      title="蛇"
      paused={paused}
      onPause={() => {
        onPause();
        setPaused(true);
      }}
      onResume={() => {
        onResume();
        setPaused(false);
      }}
    >
      <p>盤面</p>
    </Stage>
  );
}

describe("Stage", () => {
  it("AC-U2 pauses on Esc, covers the screen, focuses 続ける, and resumes on Esc", async () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    render(<PausableStage onPause={onPause} onResume={onResume} />);
    await userEvent.keyboard("{Escape}");
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "一時停止中" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "続ける" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("AC-U2 ignores Esc without onPause", async () => {
    render(
      <Stage title="数の記憶">
        <p>盤面</p>
      </Stage>,
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Result", () => {
  it("AC-U4 shows the final number at once when motion is reduced", () => {
    mediaMatches.set("(prefers-reduced-motion: reduce)", true);
    const { container } = render(<Result value={12480} note="自己ベストを更新した。" celebrate />);
    const visible = container.querySelector('.kg-result-score [aria-hidden="true"]');
    expect(visible).toHaveTextContent("12,480");
    expect(screen.getByText("12,480", { ignore: '[aria-hidden="true"]' })).toBeInTheDocument();
    expect(screen.getByText("自己ベストを更新した。")).toBeInTheDocument();
  });

  it("AC-U4 counts up while screen readers get only the final number", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const { container } = render(<Result value={500} note="はじめての記録。" />);
    const score = container.querySelector('.kg-result-score [aria-hidden="true"]');
    expect(score).toHaveTextContent("0");
    expect(screen.getByText("500", { ignore: '[aria-hidden="true"]' })).toBeInTheDocument();
    expect(screen.queryByText("はじめての記録。")).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(score).toHaveTextContent("500");
    expect(screen.getByText("はじめての記録。")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
