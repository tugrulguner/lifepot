'use client';

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import posthog, { type BeforeSendFn, type CaptureResult } from "posthog-js";

type PostHogEventEnvelope = CaptureResult & Record<string, unknown>;

const URL_KEY = /(?:url|uri|referrer|referer|destination|href)$/i;
const CAMPAIGN_KEY = /campaign|^(?:\$)?(?:(?:initial|session_entry|session_exit)_)?(?:utm_|gclid$|dclid$|gbraid$|wbraid$|fbclid$|msclkid$|ttclid$|twclid$|li_fat_id$|fbc$|fbp$|gad_source$|mc_cid$|gclsrc$|igshid$|rdt_cid$|epik$|qclid$|sccid$|irclid$|_kx$)/i;

function sanitizeValue(value: unknown, key = ""): unknown {
  if (value instanceof Date || value === null || typeof value !== "object") {
    if (typeof value !== "string") return value;
    if (CAMPAIGN_KEY.test(key)) return undefined;
    if (/^(https?:)?\/\//i.test(value)) {
      try {
        const url = new URL(value, window.location.origin);
        if (/(?:referrer|referer)$/i.test(key)) return url.origin;
        return url.origin + url.pathname;
      } catch { return undefined; }
    }
    return URL_KEY.test(key) ? undefined : value;
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry)).filter((entry) => entry !== undefined);
  const result: Record<string, unknown> = {};
  for (const [childKey, child] of Object.entries(value)) {
    if (CAMPAIGN_KEY.test(childKey)) continue;
    const clean = sanitizeValue(child, childKey);
    if (clean !== undefined) result[childKey] = clean;
  }
  return result;
}

export const sanitizePostHogEvent: BeforeSendFn = (event) => {
  if (!event || event.event === "$autocapture") return null;
  return sanitizeValue(event) as PostHogEventEnvelope;
};

function PostHogPageviewTracker() {
  const pathname = usePathname();
  const lastPageviewUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog.__loaded) {
      posthog.init("phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V", {
        api_host: "https://us.i.posthog.com",
        defaults: "2026-05-30",
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: true,
        // No feature flags or surveys are used here. Their request bypasses
        // before_send and would otherwise include persisted acquisition URLs.
        advanced_disable_flags: true,
        save_campaign_params: false,
        save_referrer: false,
        disable_capture_url_hashes: true,
        // Keep bounded web-vitals collection independent of remote flag config.
        capture_performance: true,
        before_send: sanitizePostHogEvent,
      });
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = pathname;
    currentUrl.search = "";
    currentUrl.hash = "";
    const currentUrlString = currentUrl.toString();

    if (lastPageviewUrl.current !== currentUrlString) {
      posthog.capture("$pageview", { $current_url: currentUrlString });
      lastPageviewUrl.current = currentUrlString;
    }
  }, [pathname]);

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
