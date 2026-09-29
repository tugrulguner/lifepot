import { TypeSafeClient } from "@typesafe-ai/sdk";
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
      species_A_strategy: sdkChoice("swarming", PREY_STRATEGIES),
      species_A_mutationTarget: sdkChoice("defense", MUTATION_TARGETS),
      species_A_mutationTempo: sdkChoice("slow", MUTATION_TEMPOS),
      species_B_strategy: sdkChoice("pursuit", PREDATOR_STRATEGIES),
      species_B_mutationTarget: sdkChoice("sensing", MUTATION_TARGETS),
      species_B_mutationTempo: sdkChoice("rapid", MUTATION_TEMPOS),
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
    expect(Object.keys(client.systemOne.mock.calls[0][0].questions)).toEqual(["preyStrategy", "predatorStrategy", "preyMutationTarget", "preyMutationTempo", "predatorMutationTarget", "predatorMutationTempo", "environmentPressure", "environmentIntensity", "ruleActivation", "ruleDuration", "ruleTransition", "species_A_strategy", "species_A_mutationTarget", "species_A_mutationTempo", "species_B_strategy", "species_B_mutationTarget", "species_B_mutationTempo"]);
    expect(decision.speciesDirectives).toMatchObject([
      { species: "A", strategy: { choice: "swarming" }, mutationTarget: { choice: "defense" }, mutationTempo: { choice: "slow" } },
      { species: "B", strategy: { choice: "pursuit" }, mutationTarget: { choice: "sensing" }, mutationTempo: { choice: "rapid" } },
    ]);
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

  it("uses the installed SDK wire contract for scoped questions", async () => {
    const transport = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(sdkResponse()), { headers: { "content-type": "application/json" } }));
    const client = new TypeSafeClient({ apiKey: "contract-test", baseURL: "https://api.typesafe.ai", defaultModel: "jev-latest", fetch: transport, retry: { maxRetries: 0 } });
    const result = await decideEvolution(request, { apiKey: "contract-test", client });
    expect(result.source).toBe("jev");
    expect(transport).toHaveBeenCalledOnce();
    const [url, options] = transport.mock.calls[0];
    expect(String(url)).toBe("https://api.typesafe.ai/v1/systemone");
    const payload = JSON.parse(String(options?.body));
    expect(payload.state).toEqual(summary);
    expect(payload.questions.species_A_strategy).toMatchObject({ type: "choice", criteria: expect.objectContaining({ armored: expect.any(String), swarming: expect.any(String) }) });
    expect(payload.model).toBe("jev-latest");
  });

  it.each(["missing", "wrong-palette", "non-maximum"])("atomically abstains on %s species output", async defect => {
    const response = sdkResponse();
    const answers = response.answers as Record<string, unknown>;
    if (defect === "missing") delete answers.species_B_strategy;
    else if (defect === "wrong-palette") answers.species_B_strategy = sdkChoice("armored", PREY_STRATEGIES);
    else answers.species_A_strategy = { ...sdkChoice("armored", PREY_STRATEGIES), choice: "swarming" };
    const result = await decideEvolution(request, { apiKey: "contract-test", client: { systemOne: vi.fn().mockResolvedValue(response) } });
    expect(result.source).toBe("fallback");
    expect(result.speciesDirectives).toEqual([]);
    expect(result.scheduledRuleChange).toBeUndefined();
  });

  it("rejects species observations that do not bind canonically to the graph", () => {
    const malformed = structuredClone(request);
    malformed.summary.observation.species![1].species = "A";
    expect(evolutionRequestSchema.safeParse(malformed).success).toBe(false);
  });

  it("routes evolution requests and returns a playable fallback", async () => {
    const handler = createJudgeHandler({ evolutionDecide: vi.fn().mockRejectedValue(new Error("quota")) });
    const response = await handler(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(request) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ generation: 30, trigger: "stagnation", source: "fallback", environmentPressure: { choice: expect.stringMatching(/nutrient_bloom|drought|toxin_wave|heat_wave|fragmentation|stability/) } });
  });
});