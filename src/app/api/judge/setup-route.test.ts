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
  return { answers: { abundance: choice("scarce", ["scarce", "balanced", "rich"]), distribution: choice("clustered", ["clustered", "scattered", "seasonal"]), hazard: choice("toxin", ["drought", "toxin", "heat", "crowding", "predator"]), volatility: choice("pulsing", ["stable", "pulsing", "chaotic"]), survive: score(4), replicate: score(3), cooperate: score(2), explore: score(1), adapt: score(0) } };
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
    expect(Object.keys(client.systemOne.mock.calls[0][0].questions)).toEqual(["abundance", "distribution", "hazard", "volatility", "survive", "replicate", "cooperate", "explore", "adapt"]);
    expect(result.source).toBe("jev");
  });

  it("fails closed to the deterministic setup when interpretation throws", async () => {
    const handler = (await import("./route")).createJudgeHandler({ decide: vi.fn().mockRejectedValue(new Error("offline")) });
    const response = await handler(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(input) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "fallback", requestHash: input.requestHash });
  });
});
