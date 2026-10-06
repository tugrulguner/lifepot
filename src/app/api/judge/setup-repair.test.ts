import { describe, expect, it, vi } from "vitest";
import { hashSetupRequest, type SetupAnswers } from "@/game/setup";
import { interpretSetup } from "./service";
import { councilSdkResponse, validSdkResponse } from "./setup-route.test";

const answers: SetupAnswers = { world: "A: algae producer. B: grazer eats A. C: hunter eats B, not A.", threat: "Moderate drought", reward: "Observe coexistence" };
const input = { answers, requestHash: hashSetupRequest(answers) };
function verdict(value: string) { return { model: "jev-test", usage: { input_tokens: 5, output_tokens: 1 }, answers: { verdict: { type: "choice", choice: value, confidence: .9, probabilities: Object.fromEntries(["approve", "reselect", "reject", "needs_clarification"].map(k => [k, k === value ? 1 : 0])) } } }; }
function choose(request: Parameters<typeof councilSdkResponse>[0], selections: Record<string, string>) {
 const response = councilSdkResponse(request);
 for (const [key, value] of Object.entries(selections)) if (key in response.answers) {
  response.answers[key] = { type: "choice", choice: value, confidence: 1, probabilities: Object.fromEntries(Object.keys(request.questions[key].criteria).map(k => [k, k === value ? 1 : 0])) };
 }
 return response;
}
function repairedClient(lastVerdict = "approve", firstVerdict = "reselect") {
 return { systemOne: vi.fn().mockResolvedValueOnce(validSdkResponse()).mockImplementationOnce(councilSdkResponse).mockResolvedValueOnce(verdict(firstVerdict))
  .mockImplementationOnce(r => choose(r, { speciesCount: "three", roleA: "producer", roleB: "grazer", roleC: "hunter" }))
  .mockImplementationOnce(r => choose(r, { pairAB: "b_consumes_a", pairAC: "neutral", pairBC: "b_consumes_a" }))
  .mockResolvedValueOnce(verdict(lastVerdict)).mockImplementation(councilSdkResponse) };
}
describe("bounded setup correction", () => {
 it("corrects a rejected interpretation before sending a repairable failure back to the player", async () => {
  const client = repairedClient("approve", "reject");
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never });
  expect(result.source).toBe("jev");
  expect(result.fidelity).toMatchObject({ verdict: "approve", repairAttempted: true });
  expect(result.config.rules?.interactions).toEqual([{ pair: "A:B", mode: "b_consumes_a" }, { pair: "A:C", mode: "neutral" }, { pair: "B:C", mode: "b_consumes_a" }]);
  expect(client.systemOne).toHaveBeenCalledTimes(7);
 });
 it("repairs a rejected food web in dependent stages and rechecks the corrected graph", async () => {
  const client = repairedClient(); const beforeCall = vi.fn();
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never, beforeCall });
  expect(result.fidelity?.verdict).toBe("approve");
  expect(result.config.rules?.species.map(s => s.role)).toEqual(["producer", "grazer", "hunter"]);
  expect(result.config.rules?.interactions).toEqual([{ pair: "A:B", mode: "b_consumes_a" }, { pair: "A:C", mode: "neutral" }, { pair: "B:C", mode: "b_consumes_a" }]);
  expect(client.systemOne.mock.calls[4][0].state.selected_species).toEqual(result.config.rules?.species);
  expect(client.systemOne.mock.calls[5][0].state.assembled_graph.species).toEqual(result.config.rules?.species);
  expect(client.systemOne.mock.calls[5][0].state.original_prose).toEqual(answers);
  expect(beforeCall).toHaveBeenCalledTimes(client.systemOne.mock.calls.length);
  expect(result.fidelity).toMatchObject({ repairAttempted: true });
  expect(result.usage).toEqual({ input_tokens: 150, output_tokens: 30 });
 });
 it.each(["reselect", "reject"])("bounds persistent %s and returns a targeted review without approving", async (verdict) => {
  const client = repairedClient(verdict, verdict);
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never });
  expect(result.source).toBe("jev"); expect(result.fidelity?.verdict).toBe(verdict);
  expect(result.fidelity).toMatchObject({ repairAttempted: true, focus: "species_count" });
  expect(client.systemOne).toHaveBeenCalledTimes(7);
 });
 it.each(["reselect", "reject"])("keeps %s blocked when corrected council selection fails after approval", async (firstVerdict) => {
  const client = repairedClient("approve", firstVerdict);
  client.systemOne.mockRejectedValueOnce(new Error("network unavailable"));
  const beforeCall = vi.fn();
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never, beforeCall });
  expect(result.source).toBe("jev");
  expect(result.fidelity).toMatchObject({ verdict: firstVerdict, repairAttempted: true, repairFailure: "unavailable" });
  expect(result.fidelity?.verdict).not.toBe("approve");
  expect(client.systemOne).toHaveBeenCalledTimes(7);
  expect(beforeCall).toHaveBeenCalledTimes(7);
 });
 it("keeps the rejected graph blocked when correction hits the call budget", async () => {
  const client = repairedClient(); let calls = 0;
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never, beforeCall: async () => { if (++calls === 4) throw new Error("Quota exceeded"); } });
  expect(result.source).toBe("jev"); expect(result.fidelity?.verdict).toBe("reselect");
  expect(result.fidelity).toMatchObject({ repairAttempted: true, repairFailure: "rate_limited" });
  expect(client.systemOne).toHaveBeenCalledTimes(3);
 });
});
