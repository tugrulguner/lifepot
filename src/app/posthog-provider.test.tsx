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
    autocapture: false,
    disable_session_recording: true,
    advanced_disable_flags: true,
    save_campaign_params: false,
    save_referrer: false,
    disable_capture_url_hashes: true,
    capture_performance: true,
    before_send: expect.any(Function),
  });
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenLastCalledWith("$pageview", {
    $current_url: "http://localhost:3000/",
  });
  unmount();
  cleanup();
});

test("captures one initial pageview and distinct pathnames, ignoring private query changes", async () => {
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
  expect(mockCapture).toHaveBeenCalledTimes(2);
  expect(mockCapture).toHaveBeenLastCalledWith("$pageview", {
    $current_url: "http://localhost:3000/learn",
  });

  rerender(<PostHogProvider><main>LifePot</main></PostHogProvider>);
  expect(mockCapture).toHaveBeenCalledTimes(2);

  mockPathname.mockReturnValue("/learn");
  mockSearch.mockReturnValue("topic=other");
  rerender(<PostHogProvider><main>LifePot</main></PostHogProvider>);
  expect(mockCapture).toHaveBeenCalledTimes(2);

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


test("sanitizes every URL in the event envelope while retaining Dates and safe referrer domains", async () => {
  const { sanitizePostHogEvent } = await import("./posthog-provider");
  const date = new Date("2024-01-02T03:04:05.000Z");
  const cleaned = sanitizePostHogEvent({ uuid: "fixture", event: "$pageview", properties: { $current_url: "https://lifepot.modepot.io/play?private=secret#prompt", $initial_referrer: "https://source.example/path?token=secret#fragment", safeDate: date, nested: { destination: "https://other.example/path?q=private#x", campaign: "secret" } }, $set: { $initial_referrer: "https://source.example/path?private=secret" }, $set_once: { $initial_campaign: "utm_source=private" } });
  expect(cleaned?.properties).toEqual({ $current_url: "https://lifepot.modepot.io/play", $initial_referrer: "https://source.example", safeDate: date, nested: { destination: "https://other.example/path" } });
  expect(cleaned?.$set).toEqual({ $initial_referrer: "https://source.example" });
  expect(cleaned?.$set_once).toEqual({});
});

test("drops raw campaign and advertising identifiers from nested acquisition envelopes", async () => {
  const { sanitizePostHogEvent } = await import("./posthog-provider");
  const cleaned = sanitizePostHogEvent({
    uuid: "fixture", event: "$pageleave",
    properties: { $utm_source: "PRIVATE", $initial_utm_source: "PRIVATE", $session_entry_utm_source: "PRIVATE", $session_entry_gclid: "PRIVATE", $session_entry_mc_cid: "PRIVATE", gclid: "PRIVATE", $initial_gclid: "PRIVATE", $fbc: "PRIVATE", $fbp: "PRIVATE", $referring_domain: "source.example" },
    $set: { $initial_utm_content: "PRIVATE" },
    $set_once: { $initial_msclkid: "PRIVATE" },
  });
  expect(cleaned?.properties).toEqual({ $referring_domain: "source.example" });
  expect(cleaned?.$set).toEqual({});
  expect(cleaned?.$set_once).toEqual({});
});

test("drops an event if a sensitive page element was captured", async () => {
  const { sanitizePostHogEvent } = await import("./posthog-provider");
  expect(sanitizePostHogEvent({ uuid: "fixture", event: "$autocapture", properties: { $el_text: "private name", $el_tag_name: "INPUT" } })).toBeNull();
});
