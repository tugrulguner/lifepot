'use client';

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

function PostHogPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const lastPageviewUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog.__loaded) {
      posthog.init("phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V", {
        api_host: "https://us.i.posthog.com",
        defaults: "2026-05-30",
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: { dom_event_allowlist: ["click"], element_allowlist: ["a", "button"] },
        disable_session_recording: true,
      });
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = pathname;
    currentUrl.search = queryString;
    const currentUrlString = currentUrl.toString();

    if (lastPageviewUrl.current !== currentUrlString) {
      posthog.capture("$pageview", { $current_url: currentUrlString });
      lastPageviewUrl.current = currentUrlString;
    }
  }, [pathname, queryString]);

  return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
