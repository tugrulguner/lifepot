// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { mockInit, mockCapture, mockPathname, mockSearch } = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCapture: vi.fn(),
  mockPathname: vi.fn(() => "/"),
  mockSearch: vi.fn(() => ""),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch()),
}));

vi.mock("posthog-js", () => ({ default: { __loaded: false, init: mockInit, capture: mockCapture } }));

import posthog from "posthog-js";
const init = vi.mocked(posthog.init);

import { PostHogProvider } from "./posthog-provider";

beforeEach(() => {
  mockPathname.mockReturnValue("/");
  mockSearch.mockReturnValue("");
  mockInit.mockClear();
  mockCapture.mockClear();
  Object.defineProperty(posthog, "__loaded", { configurable: true, value: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders safely on the server and initializes shared privacy-conscious PostHog in the browser effect", async () => {
  expect(() => renderToString(<PostHogProvider><main>LifePot</main></PostHogProvider>)).not.toThrow();
  expect(init).not.toHaveBeenCalled();

  const { render, cleanup } = await import("@testing-library/react");
  const { unmount } = render(<PostHogProvider><main>LifePot</main></PostHogProvider>);
  expect(init).toHaveBeenCalledTimes(1);
  expect(init).toHaveBeenCalledWith("phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V", {
    api_host: "https://us.i.posthog.com",
    defaults: "2026-05-30",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: { dom_event_allowlist: ["click"], element_allowlist: ["a", "button"] },
    disable_session_recording: true,
  });
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenLastCalledWith("$pageview", {
    $current_url: "http://localhost:3000/",
  });
  unmount();
  cleanup();
});

test("captures one initial pageview and one for each distinct pathname or query change", async () => {
  const { render, cleanup } = await import("@testing-library/react");
  const { rerender, unmount } = render(<PostHogProvider><main>LifePot</main></PostHogProvider>);

  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenLastCalledWith("$pageview", {
    $current_url: "http://localhost:3000/",
  });

  mockPathname.mockReturnValue("/learn");
  rerender(<PostHogProvider><main>LifePot</main></PostHogProvider>);
  expect(mockCapture).toHaveBeenCalledTimes(2);
  expect(mockCapture).toHaveBeenLastCalledWith("$pageview", {
    $current_url: "http://localhost:3000/learn",
  });

  mockSearch.mockReturnValue("topic=ecology");
  rerender(<PostHogProvider><main>LifePot</main></PostHogProvider>);
  expect(mockCapture).toHaveBeenCalledTimes(3);
  expect(mockCapture).toHaveBeenLastCalledWith("$pageview", {
    $current_url: "http://localhost:3000/learn?topic=ecology",
  });

  rerender(<PostHogProvider><main>LifePot</main></PostHogProvider>);
  expect(mockCapture).toHaveBeenCalledTimes(3);

  mockPathname.mockReturnValue("/learn");
  mockSearch.mockReturnValue("topic=other");
  rerender(<PostHogProvider><main>LifePot</main></PostHogProvider>);
  expect(mockCapture).toHaveBeenCalledTimes(4);
  expect(mockCapture).toHaveBeenLastCalledWith("$pageview", {
    $current_url: "http://localhost:3000/learn?topic=other",
  });

  unmount();
  cleanup();
});

test("does not track hash-only URL changes", async () => {
  const { render, cleanup } = await import("@testing-library/react");
  const { rerender, unmount } = render(<PostHogProvider><main>LifePot</main></PostHogProvider>);

  expect(mockCapture).toHaveBeenCalledTimes(1);
  window.location.hash = "#section";
  rerender(<PostHogProvider><main>LifePot</main></PostHogProvider>);
  expect(mockCapture).toHaveBeenCalledTimes(1);

  unmount();
  cleanup();
});
