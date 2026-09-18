import { describe, expect, it, vi } from "vitest";
import { createSimulation } from "@/game/world";
import { defaultConfig, type SetupAnswers } from "@/game/setup";
import { ACTIVATIONS, DURATIONS, TRANSITIONS } from "@/game/rules";
import {
  ENVIRONMENT_PRESSURES,
  INTENSITIES,
  MUTATION_TARGETS,
  MUTATION_TEMPOS,
  PREDATOR_STRATEGIES,
  PREY_STRATEGIES,
  summarizeEcology,
} from "@/game/decisions";
import { createJudgeHandler } from "./route";
import { decideEvolution } from "./service";
import { evolutionRequestSchema } from "./schema";

const intent: SetupAnswers = { world: "scarce pools with prey", threat: "predator cells and drought", reward: "co-evolve and diversify" };
const initial = createSimulation({ seed: 17, config: defaultConfig() });
const summary = summarizeEcology({ ...initial, generation: 30 }, intent, "stagnation");
const request = { kind: "evolution" as const, summary };

function sdkChoice<T extends string>(selected: T, options: readonly T[]) {
  return { type: "choice" as const, choice: selected, confidence: 0.9, probabilities: Object.fromEntries(options.map((option) => [option, option === selected ? 1 : 0])) };
}

function sdkResponse() {
  return {
    model: "jev-test",
    usage: { input_tokens: 210, output_tokens: 42 },
    answers: {
      preyStrategy: sdkChoice("armored", PREY_STRATEGIES),
      predatorStrategy: sdkChoice("pack_hunting", PREDATOR_STRATEGIES),
      preyMutationTarget: sdkChoice("defense", MUTATION_TARGETS),
      preyMutationTempo: sdkChoice("steady", MUTATION_TEMPOS),
      predatorMutationTarget: sdkChoice("sensing", MUTATION_TARGETS),
      predatorMutationTempo: sdkChoice("rapid", MUTATION_TEMPOS),
      environmentPressure: sdkChoice("fragmentation", ENVIRONMENT_PRESSURES),
      environmentIntensity: sdkChoice("medium", INTENSITIES),
      ruleActivation: sdkChoice("after_12", ACTIVATIONS),
      ruleDuration: sdkChoice("medium", DURATIONS),
      ruleTransition: sdkChoice("ramp", TRANSITIONS),
    },
  };
}

describe("evolution decision API", () => {
  it("asks bounded co-evolution and environment scheduling Choices in one Jev call", async () => {
    expect(evolutionRequestSchema.parse(request)).toEqual(request);
    const client = { systemOne: vi.fn().mockResolvedValue(sdkResponse()) };
    const decision = await decideEvolution(request, { apiKey: "test-key", client });
    expect(client.systemOne).toHaveBeenCalledOnce();
    expect(client.systemOne.mock.calls[0][0].state).toEqual(summary);
    expect(Object.keys(client.systemOne.mock.calls[0][0].questions)).toEqual(["preyStrategy", "predatorStrategy", "preyMutationTarget", "preyMutationTempo", "predatorMutationTarget", "predatorMutationTempo", "environmentPressure", "environmentIntensity", "ruleActivation", "ruleDuration", "ruleTransition"]);
    expect(decision).toMatchObject({ generation: 30, trigger: "stagnation", source: "jev", model: "jev-test", preyStrategy: { choice: "armored" }, predatorStrategy: { choice: "pack_hunting" }, environmentPressure: { choice: "fragmentation" }, scheduledRuleChange: { activation: "after_12", duration: "medium", transition: "ramp" } });
  });

  it("falls back on invalid output, failure, or unavailable credentials", async () => {
    const invalid = sdkResponse();
    invalid.answers.environmentPressure = { ...invalid.answers.environmentPressure, choice: "fragmentation", probabilities: Object.fromEntries(ENVIRONMENT_PRESSURES.map((option) => [option, option === "stability" ? 1 : 0])) };
    const invalidResult = await decideEvolution(request, { apiKey: "test-key", client: { systemOne: vi.fn().mockResolvedValue(invalid) } });
    const failedResult = await decideEvolution(request, { apiKey: "test-key", client: { systemOne: vi.fn().mockRejectedValue(new Error("offline")) } });
    const noKeyResult = await decideEvolution(request, { apiKey: "" });
    expect(invalidResult.source).toBe("fallback");
    expect(failedResult).toEqual(invalidResult);
    expect(noKeyResult).toEqual(invalidResult);
  });

  it("routes evolution requests and returns a playable fallback", async () => {
    const handler = createJudgeHandler({ evolutionDecide: vi.fn().mockRejectedValue(new Error("quota")) });
    const response = await handler(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(request) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ generation: 30, trigger: "stagnation", source: "fallback", environmentPressure: { choice: expect.stringMatching(/nutrient_bloom|drought|toxin_wave|heat_wave|fragmentation|stability/) } });
  });
});