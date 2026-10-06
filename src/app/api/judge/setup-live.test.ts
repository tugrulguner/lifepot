import { describe, expect, it } from "vitest";
import { hashSetupRequest, type SetupAnswers } from "@/game/setup";
import { interpretSetup } from "./service";

// Explicit opt-in: real inference costs money. Never treat a mocked verdict as
// evidence that Jev accepts ordinary descriptions on the proposed build.
const enabled = process.env.LIFEPOT_LIVE_SETUP_TEST === "1" && !!process.env.TYPESAFE_API_KEY;
describe.skipIf(!enabled)("live setup fidelity and bounded correction", () => {
 const cases: SetupAnswers[] = [
  { world: "A pond with algae, algae-eating grazers, and hunters that eat grazers.", threat: "Moderate drought", reward: "Observe coexistence" },
  { world: "A: algae producers. B: grazers eat A. C: hunters eat B, not A.", threat: "Crowding, stable conditions, steady nutrient regeneration", reward: "Observe coexistence" },
  { world: "Rich mineral pools with abundant prey", threat: "Predator packs hunt through pulsing droughts", reward: "Diversify while prey and predators coexist" },
 ];
 for (const [index, answers] of cases.entries()) it(`approves ordinary setup case ${index + 1} without rewriting`, async () => {
  const result = await interpretSetup({ answers, requestHash: hashSetupRequest(answers) });
  expect(result.source).toBe("jev");
  expect(result.fidelity?.verdict).toBe("approve");
  if (index === 1) {
   expect(result.config.rules?.species.map(s => s.role)).toEqual(["producer", "grazer", "hunter"]);
   expect(result.config.rules?.interactions).toEqual([{ pair: "A:B", mode: "b_consumes_a" }, { pair: "A:C", mode: "neutral" }, { pair: "B:C", mode: "b_consumes_a" }]);
  }
 }, 60000);
});
