import posthog from "posthog-js";

export type FailureCategory = "rate_limited" | "provider_unavailable" | "invalid_response" | "invalid_replay" | "setup_rejected" | "unknown";
type Capture = (event: string, properties: Record<string, string | number>) => unknown;
type Mode = "jev" | "fallback";
const reasons = new Set(["extinct", "surviving", "thriving"]);
const failures = new Set<FailureCategory>(["rate_limited", "provider_unavailable", "invalid_response", "invalid_replay", "setup_rejected", "unknown"]);
const buckets: [number, string][] = [[10, "0_10"], [50, "11_50"], [100, "51_100"], [200, "101_200"], [500, "201_500"], [1000, "501_1000"]];

export function createGameplayAnalytics(capture: Capture) {
  const started = new Set<string>();
  const terminal = new Set<string>();
  const replayed = new Set<string>();
  const emit = (event: string, properties: Record<string, string | number>) => capture(event, { ...properties, event_schema_version: 1 });
  return {
    runStarted(id: string, context: { mode: "fresh" | "replay"; interpretation: Mode; engine: string }) {
      if (started.has(id)) return;
      started.add(id);
      emit("lifepot_run_started", { entry_method: context.mode, interpretation_mode: context.interpretation, engine_version: context.engine });
    },
    runCompleted(id: string, context: { reason: string; generations: number; interpretation: Mode }) {
      if (!started.has(id) || terminal.has(id) || !reasons.has(context.reason)) return;
      terminal.add(id);
      const bucket = buckets.find(([max]) => context.generations <= max)?.[1] ?? "1001_plus";
      emit("lifepot_run_completed", { stop_reason: context.reason, generation_bucket: bucket, interpretation_mode: context.interpretation });
    },
    replayStarted(id: string, entry: "imported" | "local", engine: string) {
      if (replayed.has(id)) return;
      replayed.add(id);
      emit("lifepot_replay_started", { entry_method: entry, engine_version: engine });
    },
    followUpAccepted(_id: string, kind: "same_conditions" | "changed_conditions") {
      emit("lifepot_followup_accepted", { followup_kind: kind });
    },
    setupFailed(category: FailureCategory) {
      emit("lifepot_setup_failed", { failure_category: failures.has(category) ? category : "unknown" });
    },
  };
}

export const gameplayAnalytics = createGameplayAnalytics((event, properties) => posthog.capture(event, properties));
