import { describe, expect, it } from "vitest";
import { ruleTimingLabel, selectedChangeLabel } from "./council-display";
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
    expect(selectedChangeLabel(decision)).toBe("No intervention · inherited policies continue");
  });
  it("uses application evidence rather than elapsed time for queued, active and past labels", () => {
    const { state, decision } = fixture();
    decision.source = "jev";
    decision.scheduledRuleChange = { decidedAtGeneration: 12, activation: "after_6", duration: "short", transition: "ramp", patch: { kind: "self", species: "A", value: "cooperative" } };
    state.generation = 90;
    expect(ruleTimingLabel(decision, state)).toBe("Queued · after 6 · not yet applied");
    expect(selectedChangeLabel(decision)).toContain("Species A self interaction → cooperative");
    state.activeRuleChange = { sourceGeneration: 12, activatedAt: 88, revertAt: 93, previousRules: state.config.rules! };
    expect(ruleTimingLabel(decision, state)).toBe("Active since generation 88 · reverts after generation 93");
    state.appliedRuleChanges = [12];
    state.activeRuleChange = undefined;
    expect(ruleTimingLabel(decision, state)).toBe("Previously applied · no longer active");
  });
});
