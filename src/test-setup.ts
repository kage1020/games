import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { dismissNotice } from "./platform/notices.tsx";

export const mediaMatches = new Map<string, boolean>();

function matchMedia(query: string): MediaQueryList {
  return {
    matches: mediaMatches.get(query) ?? false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
}

vi.stubGlobal("matchMedia", matchMedia);

/** jsdom には ResizeObserver がないので、resizeElement で大きさの変化を届ける */
const resizeObservers = new Map<Element, Set<ResizeObserverCallback>>();

class FakeResizeObserver {
  readonly #callback: ResizeObserverCallback;
  readonly #targets = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element) {
    this.#targets.add(target);
    const callbacks = resizeObservers.get(target) ?? new Set();
    callbacks.add(this.#callback);
    resizeObservers.set(target, callbacks);
  }

  unobserve(target: Element) {
    this.#targets.delete(target);
    resizeObservers.get(target)?.delete(this.#callback);
  }

  disconnect() {
    for (const target of this.#targets) this.unobserve(target);
  }
}

vi.stubGlobal("ResizeObserver", FakeResizeObserver);

export function resizeElement(target: Element, width: number, height: number) {
  const entry: ResizeObserverEntry = {
    target,
    contentRect: DOMRect.fromRect({ width, height }),
    borderBoxSize: [{ inlineSize: width, blockSize: height }],
    contentBoxSize: [{ inlineSize: width, blockSize: height }],
    devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
  };
  for (const callback of resizeObservers.get(target) ?? []) {
    callback([entry], new ResizeObserver(() => undefined));
  }
}

afterEach(() => {
  cleanup();
  mediaMatches.clear();
  resizeObservers.clear();
  localStorage.clear();
  dismissNotice();
});
