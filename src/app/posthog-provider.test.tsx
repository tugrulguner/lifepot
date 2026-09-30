// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("posthog-js", () => ({ default: { init: vi.fn() } }));

import posthog from "posthog-js";
const init = vi.mocked(posthog.init);

import { PostHogProvider } from "./posthog-provider";

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
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: { dom_event_allowlist: ["click"], element_allowlist: ["a", "button"] },
    disable_session_recording: true,
  });
  unmount();
  cleanup();
});
