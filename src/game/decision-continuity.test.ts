import { describe, expect, it } from "vitest";
import { ACTIVATIONS, DURATIONS, TRANSITIONS } from "./rules";
import { ENVIRONMENT_PRESSURES, deterministicEvolutionDecision, summarizeEcology, validateEvolutionDecision } from "./decisions";
import { defaultConfig } from "./setup";
import { createSimulation, snapshotSimulation, stepSimulation } from "./world";

function certain<T extends string>(choice: T, options: readonly T[]) {
  return { choice, confidence: 1, probabilities: Object.fromEntries(options.map(option => [option, option === choice ? 1 : 0])) };
}
const intent = { world: "rich plains", threat: "heat", reward: "survival" };

describe("environmental decision continuity", () => {
  it("does not let an offline abstention flatten an already active Jev pulse", () => {
    const initial = { ...createSimulation({ seed: 33, config: defaultConfig() }), generation: 30 };
    const scheduled = validateEvolutionDecision({
      ...deterministicEvolutionDecision(summarizeEcology(initial, intent, "stagnation")),
      environmentPressure: certain("heat_wave", ENVIRONMENT_PRESSURES),
      ruleActivation: certain("immediate", ACTIVATIONS),
      ruleDuration: certain("persistent", DURATIONS),
      ruleTransition: certain("pulse", TRANSITIONS),
      scheduledRuleChange: { decidedAtGeneration: 30, activation: "immediate", duration: "persistent", transition: "pulse", patch: { kind: "environment", field: "pressure", value: "heat_wave" } },
    });
    let active = stepSimulation(initial, scheduled);
    active = stepSimulation(active, scheduled);
    active = stepSimulation(active, scheduled);
    const fallback = deterministicEvolutionDecision(summarizeEcology(active, intent, "stagnation"));
    const expected = stepSimulation(active, scheduled, [scheduled]);
    const actual = stepSimulation(active, fallback, [scheduled, fallback]);
    expect(actual.activeRuleChange).toEqual(expected.activeRuleChange);
    expect(snapshotSimulation(actual)).toEqual(snapshotSimulation(expected));
  });
});
