import { selectCouncil, runCouncil, type CouncilClient } from "../src/app/api/judge/council-service";
import { deterministicSetup, hashSetupRequest, type SetupAnswers } from "../src/game/setup";
import type { EcologySummary } from "../src/game/decisions";

// Exercise the real reconciliation contract; only the provider is simulated.
export const councilClient: CouncilClient = {
  async systemOne({ questions }) {
    const picks: Record<string, string> = { count: "6", selectedPatch: "self_A", activation: "after_6", duration: "short", transition: "ramp", activate_self_B: "skip", value: "cooperative", strategy: "armored", mutationTarget: "defense", mutationTempo: "steady" };
    const seats = ["birth_A", "birth_B", "self_A", "self_B", "pair_A_B", "environment"];
    return { model: "council-browser-fixture", usage: { input_tokens: 17, output_tokens: 9 }, answers: Object.fromEntries(Object.entries(questions).map(([key, question]) => {
      const options = Object.keys(question.criteria);
      const wanted = key.startsWith("priority_") ? (seats.includes(key.slice(9)) ? "5" : "0") : key.startsWith("activation_") ? (key === "activation_environment" ? "predation_spike" : "always") : key.startsWith("activate_") ? (picks[key] ?? "active") : picks[key.split("__").at(-1)!];
      const choice = options.includes(wanted) ? wanted : options.includes("pursuit") ? "pursuit" : options[0];
      return [key, { type: "choice", choice, confidence: .9, probabilities: Object.fromEntries(options.map(option => [option, option === choice ? .9 : .1 / (options.length - 1)])) }];
    })) };
  },
};
export async function councilSetup(answers: SetupAnswers) {
  const config = deterministicSetup(answers);
  config.rules!.species[1].role = "omnivore";
  config.rules!.interactions[0].mode = "neutral";
  config.rules!.environment.pressure = "stability";
  const selection = await selectCouncil(config.rules!, answers, councilClient);
  config.rules!.council = selection.manifest;
  config.rules!.councilSetup = selection.record;
  return { config, source: "jev", model: "setup-browser-fixture", usage: { input_tokens: 34, output_tokens: 18 }, evidence: {}, requestHash: hashSetupRequest(answers) };
}
export const councilDecision = (summary: EcologySummary) => runCouncil(summary, councilClient);
