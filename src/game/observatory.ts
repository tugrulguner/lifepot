import type { EvolutionLedger } from "./decisions";
import { selectedChangeLabel, ruleTimingLabel } from "./council-display";
import { GRID_CELLS, TRAIT_COUNT, type SimulationState } from "./world";

const TRAIT_NAMES = ["metabolism", "fecundity", "mobility", "defense", "sensing"] as const;

type TraitName = (typeof TRAIT_NAMES)[number];

export type ObservatorySpecies = {
  id: string;
  role: string;
  population: number;
  lineages: number;
  meanEnergy: number;
  meanGeneration: number;
  traits: Record<TraitName, number>;
};

export type WorldReport = {
  generation: number;
  outcome: SimulationState["outcome"];
  population: { total: number; prey: number; predators: number; births: number; deaths: number; change: number };
  resources: { mean: number; change: number };
  environment: {
    pressure: string;
    intensity: string;
    regeneration: string;
    volatility: string;
    activeSince?: number;
    revertsAt?: number | null;
  };
  species: ObservatorySpecies[];
  history: Array<{ generation: number; population: number; prey: number; predators: number; resources: number }>;
  timeline: Array<{
    generation: number;
    trigger: string;
    source: string;
    changes: string;
    timing: string;
    pressure: string;
    intensity: string;
    activation?: string;
    duration?: string;
  }>;
};

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildWorldReport(state: SimulationState, ledger: EvolutionLedger): WorldReport {
  const species = state.config.rules!.species.map((rule, slot) => {
    let population = 0;
    let energy = 0;
    let generations = 0;
    const lineages = new Set<number>();
    const traitTotals = new Array<number>(TRAIT_COUNT).fill(0);
    for (let index = 0; index < GRID_CELLS; index += 1) {
      if (!state.guild[index] || state.ruleSpecies[index] !== slot + 1) continue;
      population += 1;
      energy += state.energy[index];
      generations += state.organismGeneration[index];
      lineages.add(state.lineage[index]);
      for (let trait = 0; trait < TRAIT_COUNT; trait += 1) traitTotals[trait] += state.traits[index * TRAIT_COUNT + trait];
    }
    return {
      id: rule.id,
      role: rule.role,
      population,
      lineages: lineages.size,
      meanEnergy: rounded(energy / Math.max(1, population)),
      meanGeneration: rounded(generations / Math.max(1, population)),
      traits: Object.fromEntries(TRAIT_NAMES.map((name, trait) => [name, rounded(traitTotals[trait] / Math.max(1, population) / 255, 2)])) as Record<TraitName, number>,
    };
  });
  const baseline = state.history[0] ?? { prey: state.stats.prey, predators: state.stats.predators, resources: state.stats.resources };
  const rules = state.config.rules!.environment;
  return {
    generation: state.generation,
    outcome: state.outcome,
    population: {
      total: state.stats.population,
      prey: state.stats.prey,
      predators: state.stats.predators,
      births: state.stats.births,
      deaths: state.stats.deaths,
      change: state.stats.population - baseline.prey - baseline.predators,
    },
    resources: {
      mean: rounded(state.stats.resources / GRID_CELLS, 2),
      change: rounded((state.stats.resources - baseline.resources) / GRID_CELLS, 2),
    },
    environment: {
      pressure: rules.pressure,
      intensity: rules.intensity,
      regeneration: rules.regeneration,
      volatility: rules.volatility,
      activeSince: state.activeRuleChange?.activatedAt,
      revertsAt: state.activeRuleChange?.revertAt,
    },
    species,
    history: state.history.map((frame) => ({ generation: frame.generation, population: frame.prey + frame.predators, prey: frame.prey, predators: frame.predators, resources: rounded(frame.resources / GRID_CELLS, 2) })),
    timeline: ledger.map((decision) => ({
      generation: decision.generation,
      trigger: decision.trigger,
      source: decision.source,
      changes: selectedChangeLabel(decision),
      timing: ruleTimingLabel(decision, state),
      pressure: decision.environmentPressure.choice,
      intensity: decision.environmentIntensity.choice,
      activation: decision.scheduledRuleChange?.activation,
      duration: decision.scheduledRuleChange?.duration,
    })),
  };
}
