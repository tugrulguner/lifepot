import { GRID_SIZE, TRAIT_COUNT, strategyName, type SimulationState } from "./world";
import { TROPHIC_CAPABILITIES } from "./rules";

export const TRAIT_LABELS = ["Metabolism", "Fecundity", "Mobility", "Defense", "Sensing"] as const;
export function cellAtPoint(x: number, y: number, width: number, height: number): number | null {
  const pad = 18;
  if (x < pad || y < pad || x >= width - pad || y >= height - pad) return null;
  return Math.floor((y - pad) / (height - 2 * pad) * GRID_SIZE) * GRID_SIZE + Math.floor((x - pad) / (width - 2 * pad) * GRID_SIZE);
}
export function lineageCells(state: SimulationState, lineage: number | null): number[] {
  return lineage === null ? [] : Array.from(state.guild.keys()).filter(i => state.guild[i] && state.lineage[i] === lineage);
}
export function inspectCell(state: SimulationState, index: number) {
  const species = state.config.rules?.species[state.ruleSpecies[index] - 1];
  const diet: string[] = [];
  if (species && TROPHIC_CAPABILITIES[species.role].basalFeeding) diet.push("local nutrients");
  if (species?.selfInteraction === "cannibalistic") diet.push(`species ${species.id} (cannibalism)`);
  for (const edge of state.config.rules?.interactions ?? []) {
    const [a, b] = edge.pair.split(":");
    if (a === species?.id && edge.mode === "a_consumes_b") diet.push(`species ${b}`);
    if (b === species?.id && edge.mode === "b_consumes_a") diet.push(`species ${a}`);
  }
  return { index, occupied: Boolean(state.guild[index]), species, diet,
    energy: state.energy[index], age: state.age[index], generation: state.organismGeneration[index],
    lineage: state.lineage[index], variant: state.species[index], resources: state.resources[index], hazard: state.hazards[index],
    strategy: strategyName(state.strategy[index], state.guild[index]),
    traits: TRAIT_LABELS.map((label, axis) => ({ label, value: state.traits[index * TRAIT_COUNT + axis] })),
  };
}
