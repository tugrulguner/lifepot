import { afterEach, describe, expect, it, vi } from "vitest";
import { hashSetupRequest, type SetupAnswers } from "@/game/setup";
import { POST } from "./route";
import { interpretSetup } from "./service";

import { validSdkResponse, councilSdkResponse, withIntentCalls } from "./setup-test-fixtures";
const intent = (fn: Parameters<typeof withIntentCalls>[0]) => withIntentCalls(fn, ["grazers","hunters","lynx"], ["grazer","hunter","hunter"], {"A:B":"b_consumes_a","A:C":"b_consumes_a","B:C":"competition"});
const answers: SetupAnswers = { world: "Scarce water in clustered oases for grazers, hunters and lynx.", threat: "Toxic storms pulse across the habitat.", reward: "Reward survival and cooperation." };
const input = { answers, requestHash: hashSetupRequest(answers) };
afterEach(() => vi.unstubAllEnvs());

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
  it("batches world questions then selects a dynamic council in a dependent call", async () => {
    const fidelity = { model: "jev-test", usage: { input_tokens: 1, output_tokens: 1 }, answers: { verdict: { type: "choice", choice: "approve", confidence: 1, probabilities: { approve: 1, reselect: 0, reject: 0, needs_clarification: 0 } } } };
    const client = { systemOne: intent(vi.fn().mockResolvedValueOnce(validSdkResponse()).mockImplementationOnce(councilSdkResponse).mockResolvedValueOnce(fidelity)) };
    const result = await interpretSetup(input, { apiKey: "test", client: client as never });
    expect(client.systemOne).toHaveBeenCalledTimes(6);
    expect(Object.keys(client.systemOne.mock.calls[0][0].questions)).not.toContain("roleA");
    expect(client.systemOne.mock.calls[1][0].questions).toHaveProperty("intent_identity_A");
    expect(client.systemOne.mock.calls[2][0].questions).toHaveProperty("intent_role_A");
    expect(JSON.stringify(client.systemOne.mock.calls[3][0].questions.intent_pair_A_B)).toContain("grazers");
    expect(JSON.stringify(client.systemOne.mock.calls[3][0].questions.intent_pair_A_B)).toContain("hunters");
    expect(result.source).toBe("jev");
    expect(result.config.rules).toMatchObject({ species: [{ id: "A", role: "grazer" }, { id: "B", role: "hunter" }, { id: "C", role: "hunter" }], interactions: [{ pair: "A:B", mode: "b_consumes_a" }, { pair: "A:C", mode: "b_consumes_a" }, { pair: "B:C", mode: "competition" }] });
  });

  it("returns explicit fidelity verdict and never silently approves a reselected graph", async () => {
    const firstGraph = validSdkResponse();
    firstGraph.answers.pairAB = { ...firstGraph.answers.pairAB, choice: "neutral", probabilities: { a_consumes_b: 0, b_consumes_a: 0, competition: 0, mutualism: 0, avoidance: 0, neutral: 1 } };
    const fidelity = { model: "jev-test", usage: { input_tokens: 5, output_tokens: 1 }, answers: { verdict: { type: "choice", choice: "reselect", confidence: 1, probabilities: { approve: 0, reselect: 1, reject: 0, needs_clarification: 0 } } } };
    const client = { systemOne: intent(vi.fn().mockResolvedValueOnce(firstGraph).mockImplementationOnce(councilSdkResponse).mockResolvedValueOnce(fidelity)) };
    const response = await (await import("./route")).createJudgeHandler({ decide: (i) => interpretSetup(i, { apiKey: "test", client: client as never }) })(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(input) }));
    const body = await response.json();
    expect(client.systemOne).toHaveBeenCalledTimes(7);
    expect(body).toMatchObject({ source: "jev", fidelity: { verdict: "reselect", repairAttempted: true, repairFailure: "invalid_response" }, provenance: { outcome: "reselect" } });
    expect(body.fidelity.verdict).not.toBe("approve");
  });

  it("fails closed to the deterministic setup when interpretation throws", async () => {
    const handler = (await import("./route")).createJudgeHandler({ decide: vi.fn().mockRejectedValue(new Error("offline")) });
    const response = await handler(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(input) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "fallback", requestHash: input.requestHash });
  });
});
