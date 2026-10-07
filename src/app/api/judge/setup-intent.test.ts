import { describe, expect, it, vi } from "vitest";
import { selectSetupIntent, intentMismatches } from "./setup-intent";
import type { SetupAnswers } from "@/game/setup";
type IntentRequest = { questions: Record<string, { criteria: Record<string,string> }> };
type IntentAnswer = { type: string; choice: string; confidence: number; probabilities: Record<string,number> };

const answers: SetupAnswers = { world: "A pond with algae and tiny shrimp", threat: "A hungry heron hunts shrimp", reward: "Keep the pond alive" };
const probs = (choice: string, keys: string[]) => Object.fromEntries(keys.map((key) => [key, key === choice ? 1 : 0]));
function model(answersFor: (request: IntentRequest) => Record<string, unknown>) {
 const requests: IntentRequest[] = [];
 const client = { systemOne: vi.fn(async (request: IntentRequest) => { requests.push(request); return { model: "fixture", usage: { input_tokens: 10, output_tokens: 4 }, answers: answersFor(request) }; }) };
 return { client, requests };
}
function fixture(request: IntentRequest) {
 const answers: Record<string, IntentAnswer> = {};
 for (const [key, question] of Object.entries(request.questions)) {
   const options = Object.keys(question.criteria);
   let selected = options[options.length - 1];
   if (key.startsWith("intent_identity_")) { const name = key.endsWith("_A") ? "algae" : key.endsWith("_B") ? "shrimp" : key.endsWith("_C") ? "heron" : "No further named species"; selected = name === "No further named species" ? "none" : options.find((id) => String(question.criteria[id]).toLowerCase() === name || String(question.criteria[id]).toLowerCase().startsWith(`${name} `)) ?? "none"; }
   if (key.startsWith("intent_role_")) selected = key.endsWith("_A") ? "producer" : key.endsWith("_B") ? "grazer" : "hunter";
   if (key.startsWith("intent_pair_")) selected = key === "intent_pair_B_C" ? "b_consumes_a" : "neutral";
   answers[key] = { type: "choice", choice: selected, confidence: 1, probabilities: probs(selected, options) };
 }
 return answers;
}
const reservation = () => vi.fn(async () => {});

describe("explicit setup intent", () => {
 it("rejects an unsolicited correction that attempts to overwrite a fixed identity", async () => {
  let mappings=0;
  const {client}=model(request=>{const result=fixture(request);if(Object.keys(request.questions).some(key=>key.startsWith("intent_identity_"))){mappings++;if(mappings===1) result.intent_identity_C=result.intent_identity_B;else result.intent_identity_A=result.intent_identity_C;}return result;});
  await expect(selectSetupIntent(answers,client as never,reservation())).rejects.toThrow(/answer keys/);
  expect(client.systemOne).toHaveBeenCalledTimes(2);
 });
 it("repairs duplicate identity choices once against the already established prefix", async () => {
  let mappings = 0;
  const { client, requests } = model(request => { const result = fixture(request); if (Object.keys(request.questions).some(key => key.startsWith("intent_identity_")) && ++mappings === 1) result.intent_identity_C = result.intent_identity_B; return result; });
  const beforeCall = reservation();
  const intent = await selectSetupIntent(answers, client as never, beforeCall);
  expect(intent.species.map(s=>s.name)).toEqual(["algae","shrimp","heron"]);
  expect(requests[1].questions).not.toHaveProperty("intent_identity_A");
  expect(requests[1].questions).not.toHaveProperty("intent_identity_B");
  expect(client.systemOne).toHaveBeenCalledTimes(4); expect(beforeCall).toHaveBeenCalledTimes(4);
  expect(intent.usage).toEqual({input_tokens:40,output_tokens:16});
 });
 it("retains rejection if the one mapping correction is still inconsistent", async () => {
  let mappings = 0;
  const { client } = model(request => { const result = fixture(request); if (Object.keys(request.questions).some(key => key.startsWith("intent_identity_"))) { mappings++; if (mappings===1) result.intent_identity_C=result.intent_identity_B; else result.intent_identity_D=result.intent_identity_C; } return result; });
  const beforeCall = reservation();
  await expect(selectSetupIntent(answers,client as never,beforeCall)).rejects.toThrow(/duplicate/);
  expect(client.systemOne).toHaveBeenCalledTimes(2); expect(beforeCall).toHaveBeenCalledTimes(2);
 });
 it("maps source choices in first-mentioned order, then roles and named directional links in three reserved calls", async () => {
   const { client } = model(fixture); const beforeCall = reservation();
   const intent = await selectSetupIntent(answers, client as never, beforeCall);
   expect(client.systemOne).toHaveBeenCalledTimes(3); expect(beforeCall).toHaveBeenCalledTimes(3);
   expect(intent.species.map((s) => [s.name, s.role])).toEqual([["algae", "producer"], ["shrimp", "grazer"], ["heron", "hunter"]]);
   expect(intent.graph.interactions.find((edge) => edge.pair === "B:C")?.mode).toBe("b_consumes_a");
   expect(intent.usage).toEqual({ input_tokens: 30, output_tokens: 12 });
   expect(intentMismatches(intent, intent.graph)).toEqual([]);
 });
 it("rejects a response that drops the source-grounded hunter", async () => {
   const { client } = model((request) => { const result = fixture(request); if (Object.keys(request.questions).some((key) => key.startsWith("intent_identity_"))) { const key = "intent_identity_C"; const q = request.questions[key]; const selected = Object.keys(q.criteria).find((id: string) => q.criteria[id] === "No further named species")!; result[key] = { ...result[key], choice: selected, probabilities: probs(selected, Object.keys(q.criteria)) }; const next = "intent_identity_D"; const nextChoice = Object.keys(request.questions[next].criteria).find((id: string) => String(request.questions[next].criteria[id]).toLowerCase() === "heron")!; result[next] = { type: "choice", choice: nextChoice, confidence: 1, probabilities: probs(nextChoice, Object.keys(request.questions[next].criteria)) }; } return result; });
   await expect(selectSetupIntent(answers, client as never, reservation())).rejects.toThrow();
 });
 it("reports missing named hunter and reversed intended consumption even if a reviewer approves", async () => {
   const { client } = model(fixture); const intent = await selectSetupIntent(answers, client as never, reservation());
   const wrong = structuredClone(intent.graph); wrong.species.pop(); wrong.interactions.find((edge) => edge.pair === "B:C")!.mode = "a_consumes_b";
   expect(intentMismatches(intent, wrong).join(" ")).toMatch(/heron|species|direction|consume/i);
 });
});
