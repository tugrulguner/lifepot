import { vi } from "vitest";

export function validSdkResponse() {
  const choice = (value: string, options: string[]) => ({ type: "choice", choice: value, confidence: 0.9, probabilities: Object.fromEntries(options.map((option) => [option, option === value ? 1 : 0])) });
  const score = (value: number) => ({ type: "score", score: value, confidence: 0.8, probabilities: Object.fromEntries([0, 1, 2, 3, 4].map((n) => [String(n), n === value ? 1 : 0])), legend: { "0": "none", "1": "low", "2": "medium", "3": "high", "4": "primary" } });
  const roles = ["producer", "grazer", "hunter", "scavenger", "omnivore"], self = ["cooperative", "territorial", "cannibalistic", "neutral"], pairs = ["a_consumes_b", "b_consumes_a", "competition", "mutualism", "avoidance", "neutral"];
  return { model: "jev-test", usage: { input_tokens: 100, output_tokens: 20 }, answers: { abundance: choice("scarce", ["scarce", "balanced", "rich"]), distribution: choice("clustered", ["clustered", "scattered", "seasonal"]), hazard: choice("toxin", ["drought", "toxin", "heat", "crowding"]), volatility: choice("pulsing", ["stable", "pulsing", "chaotic"]), balance: choice("balanced", ["prey_heavy", "balanced", "predator_heavy"]), diversity: choice("varied", ["focused", "varied"]), preyStrategy: choice("armored", ["efficient_grazing", "early_brood", "armored", "swarming", "dispersal"]), predatorStrategy: choice("pack_hunting", ["ambush", "pursuit", "pack_hunting", "efficient_kill", "brood_hunting"]), speciesCount: choice("three", ["two", "three", "four"]), roleA: choice("grazer", roles), roleB: choice("hunter", roles), roleC: choice("hunter", roles), roleD: choice("scavenger", roles), selfA: choice("cooperative", self), selfB: choice("territorial", self), selfC: choice("cannibalistic", self), selfD: choice("neutral", self), pairAB: choice("b_consumes_a", pairs), pairAC: choice("b_consumes_a", pairs), pairAD: choice("neutral", pairs), pairBC: choice("competition", pairs), pairBD: choice("neutral", pairs), pairCD: choice("neutral", pairs), regeneration: choice("depletion_feedback", ["steady", "pulsed", "depletion_feedback"]), rulePressure: choice("toxin_wave", ["stability", "drought", "toxin_wave", "heat_wave", "fragmentation", "nutrient_bloom"]), ruleIntensity: choice("medium", ["low", "medium", "high"]), ruleDuration: choice("long", ["short", "medium", "long", "persistent"]), survive: score(4), replicate: score(3), cooperate: score(2), explore: score(1), adapt: score(0) } };
}

export function councilSdkResponse(request: { questions: Record<string, { criteria: Record<string, unknown> }> }) {
  return { model: "jev-test", usage: { input_tokens: 10, output_tokens: 2 }, answers: Object.fromEntries(Object.entries(request.questions).map(([key, question]) => { const options = Object.keys(question.criteria), selected = options[0]; return [key, { type: "choice", choice: selected, confidence: 1, probabilities: Object.fromEntries(options.map((option) => [option, option === selected ? 1 : 0])) }]; })) };
}

export function intentSdkResponse(request: { questions: Record<string, { criteria: Record<string, unknown> }> }, species: string[], roles: string[], pairs: Record<string, string> = {}) {
  const answers = Object.fromEntries(Object.entries(request.questions).map(([key, question]) => {
    const options = Object.keys(question.criteria); let selected = options[0];
    if (key.startsWith("intent_identity_")) { const name = species[key.at(-1)!.charCodeAt(0) - 65]; selected = name ? options.find((option) => String(question.criteria[option]).toLowerCase().startsWith(`${name.toLowerCase()} `)) ?? "none" : "none"; }
    else if (key.startsWith("intent_role_")) selected = roles[key.at(-1)!.charCodeAt(0) - 65] ?? "hunter";
    else if (key.startsWith("intent_pair_")) selected = pairs[key.slice("intent_pair_".length).replace("_", ":")] ?? "neutral";
    return [key, { type: "choice", choice: selected, confidence: 1, probabilities: Object.fromEntries(options.map((option) => [option, option === selected ? 1 : 0])) }];
  }));
  return { model: "jev-intent-test", usage: { input_tokens: 10, output_tokens: 4 }, answers };
}

export function withIntentCalls(script: (request: Parameters<typeof councilSdkResponse>[0]) => unknown, species: string[], roles: string[], pairs: Record<string, string> = {}) {
 return vi.fn(async (request: Parameters<typeof councilSdkResponse>[0] & { state: { selected_species?: unknown; assembled_graph?: { species: unknown }; original_prose?: unknown } }) => {
  if (Object.keys(request.questions).some(key => key.startsWith("intent_"))) return intentSdkResponse(request, species, roles, pairs);
  return script(request);
 });
}
