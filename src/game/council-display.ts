import type { EvolutionDecision } from "./decisions";
import type { SimulationState } from "./world";
import { relationshipLabel } from "./visuals";

export function selectedChangeLabel(decision: EvolutionDecision): string {
  if (decision.source === "fallback") return "No intervention · inherited policies continue";
  const patch = decision.scheduledRuleChange?.patch;
  const policies = decision.speciesDirectives?.map(item => `Species ${item.species} births → ${item.strategy.choice}`).join("; ");
  const change = !patch ? "No graph patch selected" : patch.kind === "self" ? `Species ${patch.species} self interaction → ${patch.value}` : patch.kind === "pair" ? relationshipLabel(patch.pair, patch.mode) : `Environment ${patch.field} → ${patch.value}`;
  return [policies, change].filter(Boolean).join("; ");
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
