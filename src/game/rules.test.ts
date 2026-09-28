import { describe, expect, it } from "vitest";
import {
  applyRulePatch,
  ruleChangeDue,
  defaultRuleGraph,
  validateScheduledRuleChange,
  validateRuleGraph,
  validateRulePatch,
  type WorldRuleGraph,
} from "./rules";

// Representative output received from Jev; this is test data, not a product default.
const jevProducedGraph: WorldRuleGraph = {
  version: 1,
  species: [
    { id: "A", role: "grazer", selfInteraction: "cooperative" },
    { id: "B", role: "hunter", selfInteraction: "territorial" },
    { id: "C", role: "hunter", selfInteraction: "cannibalistic" },
  ],
  interactions: [
    { pair: "A:B", mode: "b_consumes_a" },
    { pair: "A:C", mode: "b_consumes_a" },
    { pair: "B:C", mode: "a_consumes_b" },
  ],
  environment: {
    regeneration: "depletion_feedback",
    pressure: "drought",
    volatility: "pulsing",
    intensity: "medium",
    duration: "medium",
  },
};

describe("bounded ecosystem rule graph", () => {
  it("strictly validates canonical species and pair relationships", () => {
    expect(validateRuleGraph(jevProducedGraph)).toEqual(jevProducedGraph);
    expect(() => validateRuleGraph({ ...jevProducedGraph, executableRule: "eval(world)" })).toThrow(/rule graph/i);
    expect(() => validateRuleGraph({ ...jevProducedGraph, interactions: [...jevProducedGraph.interactions].reverse() })).toThrow(/rule graph/i);
    expect(() => validateRuleGraph({ ...jevProducedGraph, species: jevProducedGraph.species.map((species) => ({ ...species, x: 12 })) })).toThrow(/rule graph/i);
  });

  it("requires a viable basal energy path", () => {
    expect(() => validateRuleGraph({
      ...jevProducedGraph,
      species: jevProducedGraph.species.map((species) => ({ ...species, role: "hunter" as const })),
    })).toThrow(/energy path/i);
  });

  it("applies one validated relationship or environment patch without mutating the prior graph", () => {
    const graph = validateRuleGraph(jevProducedGraph);
    const pairPatch = validateRulePatch({ kind: "pair", pair: "B:C", mode: "competition" });
    const changed = applyRulePatch(graph, pairPatch);
    expect(changed.interactions.find((interaction) => interaction.pair === "B:C")?.mode).toBe("competition");
    expect(graph.interactions.find((interaction) => interaction.pair === "B:C")?.mode).toBe("a_consumes_b");

    const environmentPatch = validateRulePatch({ kind: "environment", field: "pressure", value: "toxin_wave" });
    expect(applyRulePatch(changed, environmentPatch).environment.pressure).toBe("toxin_wave");
    expect(() => validateRulePatch({ kind: "pair", pair: "B:C", mode: "competition", coordinates: [1, 2] })).toThrow(/patch/i);
  });

  it("provides a valid deterministic default graph", () => {
    expect(validateRuleGraph(defaultRuleGraph()).species).toHaveLength(2);
  });

  it("lets Jev schedule bounded environmental changes and conditions", () => {
    const scheduled = validateScheduledRuleChange({
      decidedAtGeneration: 24,
      activation: "after_12",
      duration: "long",
      transition: "ramp",
      patch: { kind: "environment", field: "pressure", value: "heat_wave" },
    });
    expect(ruleChangeDue(scheduled, 35, { resourceBand: "low", populationBand: "stable" })).toBe(false);
    expect(ruleChangeDue(scheduled, 36, { resourceBand: "low", populationBand: "stable" })).toBe(true);
    expect(() => validateScheduledRuleChange({ ...scheduled, activation: "generation_999" })).toThrow(/scheduled rule change/i);
  });
});
