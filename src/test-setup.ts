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

afterEach(() => {
  cleanup();
  mediaMatches.clear();
  localStorage.clear();
  dismissNotice();
});
