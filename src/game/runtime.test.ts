import { describe, expect, it, vi } from "vitest";
import { createSimulation, snapshotSimulation, type LifeConfig } from "./world";
import { DECISION_EPOCHS, deterministicEpochDecision, summarizeEpochState } from "./decisions";
import { advanceUntilDecisionEpoch, runFreshWithDecisions, runWithDecisionLedger } from "./runtime";
import type { SetupAnswers } from "./setup";

const intent: SetupAnswers = { world: "rich scattered nutrients", threat: "stable drought", reward: "survive and reproduce" };
const config: LifeConfig = {
  environment: { abundance: "rich", distribution: "scattered", hazard: "drought", volatility: "stable" },
  fitness: { survive: 0.35, replicate: 0.35, cooperate: 0.1, explore: 0.1, adapt: 0.1 },
};

describe("visible epoch runtime schedule", () => {
  it("stops a multi-step animation batch on an undecided epoch", () => {
    const initial = createSimulation({ seed: 930, config });
    const epochZero = deterministicEpochDecision({ ...summarizeEpochState(initial, intent), generation: 0 });
    const generation29 = runWithDecisionLedger(initial, [epochZero], 29);

    const stopped = advanceUntilDecisionEpoch(generation29, [epochZero], 3);

    expect(stopped.generation).toBe(30);
    expect(stopped.outcome).toBe("running");
  });

  it("uses the newly recorded decision for every step after its epoch", () => {
    const initial = createSimulation({ seed: 930, config });
    const epochZero = deterministicEpochDecision(summarizeEpochState(initial, intent));
    const generation30 = runWithDecisionLedger(initial, [epochZero], 30);
    const epochThirty = deterministicEpochDecision(summarizeEpochState(generation30, intent));

    expect(advanceUntilDecisionEpoch(generation30, [epochZero, epochThirty], 3).generation).toBe(33);
  });

  it("freezes and requests exactly one bounded decision at each of six epochs", async () => {
    const decide = vi.fn(async (summary) => deterministicEpochDecision(summary));
    const result = await runFreshWithDecisions(createSimulation({ seed: 930, config }), intent, decide);

    expect(decide.mock.calls.map(([summary]) => summary.generation)).toEqual(DECISION_EPOCHS);
    expect(result.ledger.map((decision) => decision.generation)).toEqual(DECISION_EPOCHS);
    expect(result.state.generation).toBe(180);
  });

  it("uses deterministic fallback when an epoch call rejects or returns invalid data", async () => {
    const decide = vi.fn().mockRejectedValue(new Error("limit"));
    const result = await runFreshWithDecisions(createSimulation({ seed: 930, config }), intent, decide);
    expect(result.ledger).toHaveLength(6);
    expect(result.ledger.every((decision) => decision.source === "fallback")).toBe(true);
    expect(result.state.generation).toBe(180);
  });

  it("replays a recorded decision ledger exactly without a decision callback", async () => {
    const fresh = await runFreshWithDecisions(createSimulation({ seed: 930, config }), intent, async (summary) => deterministicEpochDecision(summary));
    const replayed = runWithDecisionLedger(createSimulation({ seed: 930, config }), fresh.ledger);
    expect(snapshotSimulation(replayed)).toEqual(snapshotSimulation(fresh.state));
  });

  it("does not demand future decisions after extinction makes their epochs unreachable", () => {
    const initial = createSimulation({
      seed: 7,
      config,
      initialPopulation: [{ x: 10, y: 10, energy: 0, traits: [0, 0, 0, 0, 0], lineage: 1, generation: 0 }],
    });
    const epochZero = deterministicEpochDecision(summarizeEpochState(initial, intent));

    const replayed = runWithDecisionLedger(initial, [epochZero]);

    expect(replayed.outcome).toBe("extinct");
    expect(replayed.generation).toBeLessThan(30);
  });
});
