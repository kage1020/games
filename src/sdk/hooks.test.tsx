import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useGameKeys } from "./hooks.ts";

function Keys({
  onKey,
  active = true,
}: {
  onKey: (event: KeyboardEvent) => boolean | undefined;
  active?: boolean;
}) {
  useGameKeys(onKey, active);
  return (
    <div>
      <input aria-label="名前" />
      <button type="button">設定</button>
    </div>
  );
}

describe("useGameKeys", () => {
  it("passes game keys and prevents the default action when handled", async () => {
    const seen: { key: string; prevented: boolean }[] = [];
    const onKey = vi.fn((event: KeyboardEvent) => {
      queueMicrotask(() => seen.push({ key: event.key, prevented: event.defaultPrevented }));
      return event.key === "ArrowUp" ? true : undefined;
    });
    render(<Keys onKey={onKey} />);
    await userEvent.keyboard("{ArrowUp}x");
    expect(onKey).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([
      { key: "ArrowUp", prevented: true },
      { key: "x", prevented: false },
    ]);
  });

  it("ignores typing in fields and activation keys on buttons", async () => {
    const onKey = vi.fn(() => true);
    render(<Keys onKey={onKey} />);
    await userEvent.click(screen.getByRole("textbox", { name: "名前" }));
    await userEvent.keyboard("ab{ArrowUp}");
    await userEvent.click(screen.getByRole("button", { name: "設定" }));
    onKey.mockClear();
    await userEvent.keyboard(" {Enter}");
    expect(onKey).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it("stops listening while inactive", async () => {
    const onKey = vi.fn(() => true);
    render(<Keys onKey={onKey} active={false} />);
    await userEvent.keyboard("{ArrowUp}");
    expect(onKey).not.toHaveBeenCalled();
  });
});
