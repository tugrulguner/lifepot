import { describe, expect, it, vi } from "vitest";
import { createSimulation, type LifeConfig } from "@/game/world";
import { CELL_ACTIONS, COHORT_IDS, ENVIRONMENT_ACTIONS, summarizeEpochState } from "@/game/decisions";
import { type SetupAnswers } from "@/game/setup";
import { createJudgeHandler } from "./route";
import { decideEpoch } from "./service";
import { epochRequestSchema } from "./schema";

const intent: SetupAnswers = { world: "scarce pools", threat: "predators", reward: "cooperate" };
const config: LifeConfig = {
  environment: { abundance: "balanced", distribution: "scattered", hazard: "predator", volatility: "pulsing" },
  fitness: { survive: 0.2, replicate: 0.2, cooperate: 0.2, explore: 0.2, adapt: 0.2 },
};
const summary = summarizeEpochState(createSimulation({ seed: 17, config }), intent);
const request = { kind: "epoch" as const, summary };

function sdkChoice<T extends string>(selected: T, options: readonly T[]) {
  return { type: "choice", choice: selected, confidence: 0.9, probabilities: Object.fromEntries(options.map((option) => [option, option === selected ? 1 : 0])) };
}
function sdkResponse() {
  return {
    model: "jev-test",
    usage: { input_tokens: 210, output_tokens: 42 },
    answers: {
      ...Object.fromEntries(COHORT_IDS.map((id) => [`cohort_${id}`, sdkChoice("forage", CELL_ACTIONS)])),
      environment: sdkChoice("bloom", ENVIRONMENT_ACTIONS),
    },
  };
}

describe("epoch decision API", () => {
  it("accepts one frozen structured state and asks all cohort and environment Choices in one Jev call", async () => {
    expect(epochRequestSchema.parse(request)).toEqual(request);
    const client = { systemOne: vi.fn().mockResolvedValue(sdkResponse()) };
    const decision = await decideEpoch(request, { apiKey: "test-key", client });

    expect(client.systemOne).toHaveBeenCalledOnce();
    expect(client.systemOne.mock.calls[0][0].state).toEqual(summary);
    expect(Object.keys(client.systemOne.mock.calls[0][0].questions)).toEqual([
      "cohort_energy_stressed", "cohort_efficient_foragers", "cohort_explorers", "cohort_resilient", "cohort_generalists", "environment",
    ]);
    expect(decision).toMatchObject({ generation: 0, source: "jev", model: "jev-test", usage: { input_tokens: 210, output_tokens: 42 }, environment: { choice: "bloom" } });
  });

  it("falls back deterministically on invalid output, failure, or unavailable credentials", async () => {
    const invalid = sdkResponse();
    invalid.answers.environment = { ...invalid.answers.environment, choice: "bloom", probabilities: Object.fromEntries(ENVIRONMENT_ACTIONS.map((option) => [option, option === "hold" ? 1 : 0])) };
    const invalidResult = await decideEpoch(request, { apiKey: "test-key", client: { systemOne: vi.fn().mockResolvedValue(invalid) } });
    const failedResult = await decideEpoch(request, { apiKey: "test-key", client: { systemOne: vi.fn().mockRejectedValue(new Error("offline")) } });
    const noKeyResult = await decideEpoch(request, { apiKey: "" });
    expect(invalidResult.source).toBe("fallback");
    expect(failedResult).toEqual(invalidResult);
    expect(noKeyResult).toEqual(invalidResult);
  });

  it("routes epoch requests and returns a playable fallback instead of a transport dead end", async () => {
    const handler = createJudgeHandler({ epochDecide: vi.fn().mockRejectedValue(new Error("quota")) });
    const response = await handler(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(request) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ generation: 0, source: "fallback", environment: { choice: expect.stringMatching(/bloom|redistribute|hazard_surge|relief|hold/) } });
  });
});
