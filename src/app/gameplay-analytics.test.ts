import { describe, expect, it, vi } from "vitest";
import { createGameplayAnalytics } from "./gameplay-analytics";

describe("privacy-safe gameplay analytics", () => {
  it("emits bounded lifecycle events once per run and ignores private fields", () => {
    const capture = vi.fn();
    const analytics = createGameplayAnalytics(capture);
    analytics.runStarted("run-1", { mode: "fresh", interpretation: "fallback", engine: "v3" });
    analytics.runStarted("run-1", { mode: "fresh", interpretation: "fallback", engine: "v3" });
    analytics.runCompleted("run-1", { reason: "extinct", generations: 250, interpretation: "fallback" });
    analytics.runCompleted("run-1", { reason: "extinct", generations: 250, interpretation: "fallback" });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenNthCalledWith(1, "lifepot_run_started", {
      entry_method: "fresh", interpretation_mode: "fallback", engine_version: "v3", event_schema_version: 1,
    });
    expect(capture).toHaveBeenNthCalledWith(2, "lifepot_run_completed", {
      stop_reason: "extinct", generation_bucket: "201_500", interpretation_mode: "fallback", event_schema_version: 1,
    });
    expect(JSON.stringify(capture.mock.calls)).not.toMatch(/prompt|seed|name|replay|state|rawerror/i);
  });

  it("records each actual engine terminal outcome", () => {
    const capture = vi.fn();
    const analytics = createGameplayAnalytics(capture);
    analytics.runStarted("run", { mode: "fresh", interpretation: "fallback", engine: "v3" });
    for (const reason of ["extinct", "surviving", "thriving"] as const) {
      analytics.runCompleted("run-" + reason, { reason, generations: 10, interpretation: "fallback" });
      analytics.runStarted("run-" + reason, { mode: "fresh", interpretation: "fallback", engine: "v3" });
      analytics.runCompleted("run-" + reason, { reason, generations: 10, interpretation: "fallback" });
    }
    expect(capture.mock.calls.filter(([event]) => event === "lifepot_run_completed").map(([, props]) => props.stop_reason)).toEqual(["extinct", "surviving", "thriving"]);
  });

  it("counts each accepted follow-up action separately", () => {
    const capture = vi.fn();
    const analytics = createGameplayAnalytics(capture);
    analytics.followUpAccepted("run-1", "changed_conditions");
    analytics.followUpAccepted("run-1", "changed_conditions");
    expect(capture.mock.calls.filter(([event]) => event === "lifepot_followup_accepted")).toHaveLength(2);
  });

  it("bounds failure categories and marks accepted replay and follow-up transitions", () => {
    const capture = vi.fn();
    const analytics = createGameplayAnalytics(capture);
    analytics.setupFailed("rate_limited");
    analytics.setupFailed("secret text" as never);
    analytics.replayStarted("run-2", "imported", "v3");
    analytics.followUpAccepted("run-3", "changed_conditions");
    expect(capture.mock.calls).toEqual([
      ["lifepot_setup_failed", { failure_category: "rate_limited", event_schema_version: 1 }],
      ["lifepot_setup_failed", { failure_category: "unknown", event_schema_version: 1 }],
      ["lifepot_replay_started", { entry_method: "imported", engine_version: "v3", event_schema_version: 1 }],
      ["lifepot_followup_accepted", { followup_kind: "changed_conditions", event_schema_version: 1 }],
    ]);
  });
});
