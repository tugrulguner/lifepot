import { describe, expect, it } from "vitest";
import { deathProgress, retainDeathTraces, type DeathTrace } from "./visuals";

describe("death visual lifecycle", () => {
  it("keeps a dead cell visible through its 420ms shrink/fade window", () => {
    expect(deathProgress(0, false)).toBe(0);
    expect(deathProgress(245, false)).toBeGreaterThan(0);
    expect(deathProgress(245, false)).toBeLessThan(1);
    expect(deathProgress(419, false)).toBeLessThan(1);
    expect(deathProgress(420, false)).toBe(1);
  });

  it("removes death traces only after expiry and immediately for reduced motion", () => {
    const traces: DeathTrace[] = [{ index: 7, lineage: 3, startedAt: 1_000 }];
    expect(retainDeathTraces(traces, 1_419, false)).toHaveLength(1);
    expect(retainDeathTraces(traces, 1_420, false)).toHaveLength(0);
    expect(retainDeathTraces(traces, 1_001, true)).toHaveLength(0);
  });
});
