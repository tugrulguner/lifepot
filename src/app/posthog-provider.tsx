'use client';

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (posthog.__loaded) return;

    posthog.init("phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V", {
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: { dom_event_allowlist: ["click"], element_allowlist: ["a", "button"] },
      disable_session_recording: true,
    });
  }, []);

  return children;
}
