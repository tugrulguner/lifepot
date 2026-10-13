import { describe, expect, it } from "vitest";
import { ruleTimingLabel, selectedChangeLabel, conciseChangeLabel } from "./council-display";
import { deterministicSetup } from "./setup";
import { createSimulation } from "./world";
import { deterministicEvolutionDecision, summarizeEcology } from "./decisions";

const answers = { world: "rich minerals", threat: "stable", reward: "coexist" };
function fixture() {
  const state = createSimulation({ seed: 12, config: deterministicSetup(answers) });
  state.generation = 12;
  const decision = deterministicEvolutionDecision(summarizeEcology(state, answers, "stagnation"));
  return { state, decision };
}
describe("council display truthfulness", () => {
  it("never labels fallback default pressure as an intervention", () => {
    const { decision } = fixture();
    expect(selectedChangeLabel(decision)).toBe("No intervention selected; existing world rules and birth policies continue");
  });
  it("states accurately that no graph change leaves existing rules in place", () => {
    const { decision } = fixture();
    decision.source = "jev";
    decision.speciesDirectives = [];
    expect(selectedChangeLabel(decision)).toMatch(/No ecosystem rule change selected; existing world rules and birth policies continue/);
  });
  it("describes recorded birth policies as future births, not immediate actions", () => {
    const { decision } = fixture();
    decision.source = "jev";
    decision.speciesDirectives = [{ species: "A", strategy: { choice: "early_brood", confidence: 1, probabilities: { efficient_grazing: 0, early_brood: 1, armored: 0, swarming: 0, dispersal: 0 } }, mutationTarget: { choice: "fecundity", confidence: 1, probabilities: { metabolism: 0, fecundity: 1, mobility: 0, defense: 0, sensing: 0 } }, mutationTempo: { choice: "steady", confidence: 1, probabilities: { slow: 0, steady: 1, rapid: 0 } } }];
    const before = structuredClone(decision);
    const label = selectedChangeLabel(decision);
    expect(label).toMatch(/Future births of species A/);
    expect(label).toMatch(/lower energy threshold/);
    expect(label).not.toMatch(/early_brood/);
    expect(decision).toEqual(before);
  });
  it("summarizes the longest species policy set compactly without changing its input", () => {
    const { decision } = fixture();
    decision.source = "jev";
    decision.speciesDirectives = (["A", "B", "C", "D"] as const).map(species => ({ species, strategy: { choice: "early_brood" as const, confidence: 1, probabilities: { efficient_grazing: 0, early_brood: 1, armored: 0, swarming: 0, dispersal: 0 } }, mutationTarget: { choice: "fecundity" as const, confidence: 1, probabilities: { metabolism: 0, fecundity: 1, mobility: 0, defense: 0, sensing: 0 } }, mutationTempo: { choice: "steady" as const, confidence: 1, probabilities: { slow: 0, steady: 1, rapid: 0 } } }));
    const before = structuredClone(decision);
    expect(conciseChangeLabel(decision)).toBe("Species A births: lower reproduction threshold · Species B births: lower reproduction threshold · Species C births: lower reproduction threshold · Species D births: lower reproduction threshold · Existing world rules unchanged");
    expect(conciseChangeLabel(decision).length).toBeLessThan(230);
    expect(decision).toEqual(before);
  });

  it("uses application evidence rather than elapsed time for queued, active and past labels", () => {
    const { state, decision } = fixture();
    decision.source = "jev";
    decision.scheduledRuleChange = { decidedAtGeneration: 12, activation: "after_6", duration: "short", transition: "ramp", patch: { kind: "self", species: "A", value: "cooperative" } };
    state.generation = 90;
    expect(ruleTimingLabel(decision, state)).toBe("Queued · after 6 · not yet applied");
    expect(selectedChangeLabel(decision)).toMatch(/Species A self-interaction change: nearby same-species organisms can reduce upkeep/);
    expect(ruleTimingLabel(decision, state)).toContain("not yet applied");
    state.activeRuleChange = { sourceGeneration: 12, activatedAt: 88, revertAt: 93, previousRules: state.config.rules! };
    expect(ruleTimingLabel(decision, state)).toBe("Active since generation 88 · reverts after generation 93");
    state.appliedRuleChanges = [12];
    state.activeRuleChange = undefined;
    expect(ruleTimingLabel(decision, state)).toBe("Previously applied · no longer active");
  });
});
