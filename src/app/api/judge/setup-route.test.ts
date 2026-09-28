import { afterEach, describe, expect, it, vi } from "vitest";
import { hashSetupRequest, type SetupAnswers } from "@/game/setup";
import { POST } from "./route";
import { interpretSetup } from "./service";

const answers: SetupAnswers = { world: "Scarce water in clustered oases.", threat: "Toxic storms pulse across the habitat.", reward: "Reward survival and cooperation." };
const input = { answers, requestHash: hashSetupRequest(answers) };
afterEach(() => vi.unstubAllEnvs());

export function validSdkResponse() {
  const choice = (value: string, options: string[]) => ({ type: "choice", choice: value, confidence: 0.9, probabilities: Object.fromEntries(options.map((option) => [option, option === value ? 1 : 0])) });
  const score = (value: number) => ({ type: "score", score: value, confidence: 0.8, probabilities: { "0": value === 0 ? 1 : 0, "1": value === 1 ? 1 : 0, "2": value === 2 ? 1 : 0, "3": value === 3 ? 1 : 0, "4": value === 4 ? 1 : 0 }, legend: { "0": "none", "1": "low", "2": "medium", "3": "high", "4": "primary" } });
  const roles = ["producer", "grazer", "hunter", "scavenger", "omnivore"];
  const self = ["cooperative", "territorial", "cannibalistic", "neutral"];
  const pairs = ["a_consumes_b", "b_consumes_a", "competition", "mutualism", "avoidance", "neutral"];
  return { model: "jev-test", usage: { input_tokens: 100, output_tokens: 20 }, answers: { abundance: choice("scarce", ["scarce", "balanced", "rich"]), distribution: choice("clustered", ["clustered", "scattered", "seasonal"]), hazard: choice("toxin", ["drought", "toxin", "heat", "crowding"]), volatility: choice("pulsing", ["stable", "pulsing", "chaotic"]), balance: choice("balanced", ["prey_heavy", "balanced", "predator_heavy"]), diversity: choice("varied", ["focused", "varied"]), preyStrategy: choice("armored", ["efficient_grazing", "early_brood", "armored", "swarming", "dispersal"]), predatorStrategy: choice("pack_hunting", ["ambush", "pursuit", "pack_hunting", "efficient_kill", "brood_hunting"]), speciesCount: choice("three", ["two", "three", "four"]), roleA: choice("grazer", roles), roleB: choice("hunter", roles), roleC: choice("hunter", roles), roleD: choice("scavenger", roles), selfA: choice("cooperative", self), selfB: choice("territorial", self), selfC: choice("cannibalistic", self), selfD: choice("neutral", self), pairAB: choice("b_consumes_a", pairs), pairAC: choice("b_consumes_a", pairs), pairAD: choice("neutral", pairs), pairBC: choice("competition", pairs), pairBD: choice("neutral", pairs), pairCD: choice("neutral", pairs), regeneration: choice("depletion_feedback", ["steady", "pulsed", "depletion_feedback"]), rulePressure: choice("toxin_wave", ["stability", "drought", "toxin_wave", "heat_wave", "fragmentation", "nutrient_bloom"]), ruleIntensity: choice("medium", ["low", "medium", "high"]), ruleDuration: choice("long", ["short", "medium", "long", "persistent"]), survive: score(4), replicate: score(3), cooperate: score(2), explore: score(1), adapt: score(0) } };
}

describe("POST /api/judge setup interpretation", () => {
  it("validates exactly three bounded text answers", async () => {
    const response = await POST(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify({ answers: { arbitrary: "prompt" }, requestHash: "x" }) }));
    expect(response.status).toBe(400);
  });
  it("returns deterministic semantic fallback when paid calls are unavailable", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const response = await POST(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(input) }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ source: "fallback", requestHash: input.requestHash, config: { environment: { abundance: "scarce", distribution: "clustered", hazard: "toxin", volatility: "pulsing" } } });
  });
  it("asks all independent Choice and Score questions in one bounded call", async () => {
    const client = { systemOne: vi.fn().mockResolvedValue(validSdkResponse()) };
    const result = await interpretSetup(input, { apiKey: "test-key", client });
    expect(client.systemOne).toHaveBeenCalledOnce();
    expect(Object.keys(client.systemOne.mock.calls[0][0].questions)).toEqual(["abundance", "distribution", "hazard", "volatility", "balance", "diversity", "preyStrategy", "predatorStrategy", "speciesCount", "roleA", "roleB", "roleC", "roleD", "selfA", "selfB", "selfC", "selfD", "pairAB", "pairAC", "pairAD", "pairBC", "pairBD", "pairCD", "regeneration", "rulePressure", "ruleIntensity", "ruleDuration", "survive", "replicate", "cooperate", "explore", "adapt"]);
    expect(result.source).toBe("jev");
    expect(result.config.rules).toMatchObject({ species: [{ id: "A", role: "grazer" }, { id: "B", role: "hunter" }, { id: "C", role: "hunter" }], interactions: [{ pair: "A:B", mode: "b_consumes_a" }, { pair: "A:C", mode: "b_consumes_a" }, { pair: "B:C", mode: "competition" }] });
  });

  it("fails closed to the deterministic setup when interpretation throws", async () => {
    const handler = (await import("./route")).createJudgeHandler({ decide: vi.fn().mockRejectedValue(new Error("offline")) });
    const response = await handler(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(input) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "fallback", requestHash: input.requestHash });
  });
});
