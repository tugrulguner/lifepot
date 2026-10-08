import { describe, expect, it } from "vitest";
import { advanceUntilDecisionTrigger, runFreshWithDecisions } from "./runtime";
import { deterministicEvolutionDecision } from "./decisions";
import { createSimulation, snapshotSimulation } from "./world";
import { defaultConfig } from "./setup";

describe("observing every runtime step", () => {
  it("includes the terminal generation and every decision-trigger generation", async () => {
    const initial = createSimulation({ seed: 33, config: defaultConfig() });
    const run = await runFreshWithDecisions(initial, { world: "test", threat: "test", reward: "test" }, async summary => deterministicEvolutionDecision(summary));
    const observed: number[] = [];
    const final = advanceUntilDecisionTrigger(initial, run.ledger, 180, state => observed.push(state.generation));
    expect(final.generation).toBe(run.state.generation);
    expect(observed.at(-1)).toBe(final.generation);
    for (const decision of run.ledger) expect(observed).toContain(decision.generation);
    expect(snapshotSimulation(final)).toEqual(snapshotSimulation(run.state));
  }, 20_000);
  it("observes each generation at accelerated speed without changing the trajectory", () => {
    const initial = createSimulation({ seed: 33, config: defaultConfig() });
    const observed: number[] = [];
    const next = advanceUntilDecisionTrigger(initial, [], 3, state => observed.push(state.generation));
    expect(observed).toEqual([1, 2, 3]);
    expect(snapshotSimulation(next)).toEqual(snapshotSimulation(advanceUntilDecisionTrigger(initial, [], 3)));
  });
});
