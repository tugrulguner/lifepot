import type { EvolutionDecision } from "./decisions";
import type { SimulationState } from "./world";
import { rulePatchMeaning, strategyMeaning } from "./policy-language";

export function selectedChangeLabel(decision: EvolutionDecision): string {
  if (decision.source === "fallback") return "No intervention selected; existing world rules and birth policies continue";

  const policies = decision.speciesDirectives?.map(item =>
    `Future births of species ${item.species}: ${strategyMeaning(item.strategy.choice)}`,
  ) ?? (decision.speciesDirectives === undefined ? [
    decision.preyStrategy?.choice ? `Future basal-consumer births: ${strategyMeaning(decision.preyStrategy.choice)}` : "",
    decision.predatorStrategy?.choice ? `Future hunter births: ${strategyMeaning(decision.predatorStrategy.choice)}` : "",
  ].filter(Boolean) : []);
  const patch = decision.scheduledRuleChange?.patch;
  const change = patch
    ? rulePatchMeaning(patch)
    : policies.length
      ? "No ecosystem rule change selected; existing world rules remain in place"
      : "No ecosystem rule change selected; existing world rules and birth policies continue";
  return [...policies, change].join("; ");
}

// Only engine state proves activation. A selected or elapsed schedule is not proof.
export function ruleTimingLabel(decision: EvolutionDecision, state: SimulationState): string {
  const change = decision.scheduledRuleChange;
  if (!change) return "";
  if (state.maintainedRuleChanges?.includes(decision.generation)) return "Maintained existing rule · no ecological change";
  const active = state.activeRuleChange;
  if (active?.sourceGeneration === decision.generation) return `Active since generation ${active.activatedAt} · ${active.revertAt === null ? "persistent" : `reverts after generation ${active.revertAt}`}`;
  if (state.appliedRuleChanges.includes(decision.generation)) return "Previously applied · no longer active";
  return `Queued · ${change.activation.replaceAll("_", " ")} · not yet applied`;
}
