import { describe, expect, it, vi } from "vitest";
import { hashSetupRequest, type SetupAnswers } from "@/game/setup";
import { interpretSetup } from "./service";
import { councilSdkResponse, validSdkResponse, withIntentCalls } from "./setup-test-fixtures";

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
function repairedClient(lastVerdict = "approve", firstVerdict = "reselect", failCouncil = false, corruption: "none" | "role" | "pair" = "none") {
 const script = vi.fn().mockResolvedValueOnce(validSdkResponse()).mockImplementationOnce(councilSdkResponse).mockResolvedValueOnce(verdict(firstVerdict))
  .mockImplementationOnce(r => choose(r, { speciesCount: "three", roleA: "producer", roleB: "grazer", roleC: corruption === "role" ? "grazer" : "hunter" }))
  .mockImplementationOnce(r => choose(r, { pairAB: "b_consumes_a", pairAC: "neutral", pairBC: corruption === "pair" ? "a_consumes_b" : "b_consumes_a" }))
  .mockResolvedValueOnce(verdict(lastVerdict)).mockImplementation(councilSdkResponse);
 if (failCouncil) script.mockRejectedValueOnce(new Error("network unavailable"));
 return { systemOne: withIntentCalls(script, ["algae","grazer","hunter"], ["producer","grazer","hunter"], {"A:B":"b_consumes_a","A:C":"neutral","B:C":"b_consumes_a"}) };
}
describe("bounded setup correction", () => {
 it("reserves and accounts for both bounded corrections without exceeding eleven provider calls", async () => {
  const client=repairedClient(); const script=client.systemOne;
  const usages:{input_tokens:number;output_tokens:number}[]=[]; let firstMapping=true;
  client.systemOne=vi.fn(async request=>{const response=await script(request) as ReturnType<typeof councilSdkResponse>;if(Object.keys(request.questions).includes("intent_identity_A")&&firstMapping){firstMapping=false;response.answers.intent_identity_C=response.answers.intent_identity_B;}usages.push(response.usage);return response;});
  const beforeCall=vi.fn();const result=await interpretSetup(input,{apiKey:"test",client:client as never,beforeCall});
  expect(result.fidelity?.verdict).toBe("approve");
  expect(result.config.rules?.species.map(s=>s.role)).toEqual(["producer","grazer","hunter"]);
  expect(client.systemOne).toHaveBeenCalledTimes(11);expect(beforeCall).toHaveBeenCalledTimes(11);
  expect(result.usage).toEqual(usages.reduce((sum,u)=>({input_tokens:sum.input_tokens+u.input_tokens,output_tokens:sum.output_tokens+u.output_tokens}),{input_tokens:0,output_tokens:0}));
 });
 it.each(["role", "pair"] as const)("blocks false approval when repair corrupts the established %s", async corruption => {
  const client = repairedClient("approve", "reselect", false, corruption);
  const result = await interpretSetup(input, { apiKey: "test", client: client as never });
  expect(result.source).toBe("jev");
  expect(result.fidelity).toMatchObject({ verdict: "reselect", repairAttempted: true });
  expect(result.fidelity?.mismatches?.join(" ")).toMatch(corruption === "role" ? /hunter.*role/ : /grazer\/hunter.*b_consumes_a.*a_consumes_b/);
 });
 it("classifies a score-distribution mismatch at the initial interpretation stage", async () => {
  const response = validSdkResponse(); response.answers.survive.score = 0;
  const client = { systemOne: vi.fn().mockResolvedValue(response) };
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never });
  expect(result).toMatchObject({ source: "fallback", fallbackReason: "invalid_response", failure: { stage: "initial_interpretation", code: "invalid_response" } });
 });
 it("corrects a rejected interpretation before sending a repairable failure back to the player", async () => {
  const client = repairedClient("approve", "reject");
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never });
  expect(result.source).toBe("jev");
  expect(result.fidelity).toMatchObject({ verdict: "approve", repairAttempted: true });
  expect(result.config.rules?.interactions).toEqual([{ pair: "A:B", mode: "b_consumes_a" }, { pair: "A:C", mode: "neutral" }, { pair: "B:C", mode: "b_consumes_a" }]);
  expect(client.systemOne).toHaveBeenCalledTimes(10);
 });
 it("repairs a rejected food web in dependent stages and rechecks the corrected graph", async () => {
  const client = repairedClient(); const beforeCall = vi.fn();
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never, beforeCall });
  expect(result.fidelity?.verdict).toBe("approve");
  expect(result.config.rules?.species.map(s => s.role)).toEqual(["producer", "grazer", "hunter"]);
  expect(result.config.rules?.interactions).toEqual([{ pair: "A:B", mode: "b_consumes_a" }, { pair: "A:C", mode: "neutral" }, { pair: "B:C", mode: "b_consumes_a" }]);
  expect(client.systemOne.mock.calls[7][0].state.selected_species).toEqual(result.config.rules?.species);
  expect(client.systemOne.mock.calls[8][0].state.assembled_graph?.species).toEqual(result.config.rules?.species);
  expect(client.systemOne.mock.calls[8][0].state.original_prose).toEqual(answers);
  expect(beforeCall).toHaveBeenCalledTimes(client.systemOne.mock.calls.length);
  expect(result.fidelity).toMatchObject({ repairAttempted: true });
  expect(result.usage).toEqual({ input_tokens: 180, output_tokens: 42 });
 });
 it.each(["reselect", "reject"])("bounds persistent %s and returns a targeted review without approving", async (verdict) => {
  const client = repairedClient(verdict, verdict);
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never });
  expect(result.source).toBe("jev"); expect(result.fidelity?.verdict).toBe(verdict);
  expect(result.fidelity).toMatchObject({ repairAttempted: true, focus: "species_count" });
  expect(client.systemOne).toHaveBeenCalledTimes(10);
 });
 it.each(["reselect", "reject"])("keeps %s blocked when corrected council selection fails after approval", async (firstVerdict) => {
  const client = repairedClient("approve", firstVerdict, true);
  const beforeCall = vi.fn();
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never, beforeCall });
  expect(result.source).toBe("jev");
  expect(result.fidelity).toMatchObject({ verdict: firstVerdict, repairAttempted: true, repairFailure: "unavailable" });
  expect(result.fidelity?.verdict).not.toBe("approve");
  expect(client.systemOne).toHaveBeenCalledTimes(10);
  expect(beforeCall).toHaveBeenCalledTimes(10);
 });
 it("keeps the rejected graph blocked when correction hits the call budget", async () => {
  const client = repairedClient(); let calls = 0;
  const result = await interpretSetup(input, { apiKey: "test-key", client: client as never, beforeCall: async () => { if (++calls === 7) throw new Error("Quota exceeded"); } });
  expect(result.source).toBe("jev"); expect(result.fidelity?.verdict).toBe("reselect");
  expect(result.fidelity).toMatchObject({ repairAttempted: true, repairFailure: "rate_limited" });
  expect(client.systemOne).toHaveBeenCalledTimes(6);
 });
 it("reports the stage and safe failure code for an invalid initial response", async () => {
  const client = { systemOne: vi.fn().mockRejectedValue(new Error("provider returned malformed response")) };
  const result = await interpretSetup(input, { apiKey: "test", client: client as never });
  expect(result).toMatchObject({ source: "fallback", fallbackReason: "invalid_response", failure: { stage: "initial_interpretation", code: "invalid_response" } });
 });
});
