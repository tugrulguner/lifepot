import { expect, it } from "vitest";
import { sanitizeAnalyticsProperties } from "./analytics-privacy";
it("strips query, fragments and URL credentials from pageview, leave, acquisition and link properties", () => {
  const unsafe = "https://person:secret@lifepot.modepot.io/play?replay=PRIVATE_SETUP#replay=PRIVATE_LEDGER";
  const input = { $current_url: unsafe, $referrer: unsafe, $set_once: { $initial_current_url: unsafe, $initial_referrer: unsafe }, $elements: [{ attr__href: "/play?world=PRIVATE_NAME#PRIVATE_NOTES", tag_name: "a" }], $referring_domain: "modepot.io" };
  const result = sanitizeAnalyticsProperties(input);
  expect(result).toEqual({ $current_url: "https://lifepot.modepot.io/play", $referrer: "https://lifepot.modepot.io/play", $set_once: { $initial_current_url: "https://lifepot.modepot.io/play", $initial_referrer: "https://lifepot.modepot.io/play" }, $elements: [{ attr__href: "/play", tag_name: "a" }], $referring_domain: "modepot.io" });
  expect(input.$current_url).toContain("PRIVATE_SETUP");
});
it("preserves direct attribution and rejects malformed URL properties rather than sending arbitrary prose", () => {
  expect(sanitizeAnalyticsProperties({ $referrer: "$direct", $current_url: "not a url containing private prose" })).toEqual({ $referrer: "$direct", $current_url: "" });
});
