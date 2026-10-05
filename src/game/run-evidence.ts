import { GRID_CELLS, type SimulationState } from "./world";

export type SpeciesSample = { speciesId: string; role: string; population: number };
export type RunSample = { generation: number; population: number; prey: number; predators: number; resources: number; births: number; deaths: number; kills: number; species: SpeciesSample[] };
export type RunRuleEvent = { kind: "activated"; generation: number; sourceGeneration: number; revertAt: number | null } | { kind: "reverted"; generation: number };
export type RunEvidence = { samples: RunSample[]; firstExtinction: Array<{ speciesId: string; generation: number }>; peakPopulation: number; ruleEvents: RunRuleEvent[]; observedRuleVersion: number; activeRuleIdentity?: string | null };

function sample(state: SimulationState): RunSample {
  const species = state.config.rules!.species.map((rule, slot) => {
    let population = 0;
    for (let i = 0; i < GRID_CELLS; i += 1) if (state.guild[i] && state.ruleSpecies[i] === slot + 1) population += 1;
    return { speciesId: rule.id, role: rule.role, population };
  });
  return { generation: state.generation, population: state.stats.population, prey: state.stats.prey, predators: state.stats.predators, resources: state.stats.resources, births: state.stats.births, deaths: state.stats.deaths, kills: state.stats.kills, species };
}

export function createRunEvidence(initial: SimulationState): RunEvidence {
  const first = sample(initial);
  return { samples: [first], firstExtinction: [], peakPopulation: first.population, ruleEvents: [], observedRuleVersion: initial.config.rules!.version, activeRuleIdentity: null };
}

export function observeRun(evidence: RunEvidence, state: SimulationState): RunEvidence {
  const previous = evidence.samples[evidence.samples.length - 1];
  if (previous?.generation === state.generation) return evidence;
  if (previous && state.generation < previous.generation) return evidence;
  const current = sample(state);
  const firstExtinction = evidence.firstExtinction.slice();
  for (const item of current.species) if (item.population === 0 && (previous?.species.find(old => old.speciesId === item.speciesId)?.population ?? 0) > 0 && !firstExtinction.some(event => event.speciesId === item.speciesId)) firstExtinction.push({ speciesId: item.speciesId, generation: state.generation });
  const ruleEvents = evidence.ruleEvents.slice();
  const change = state.activeRuleChange;
  const activeIdentity = change ? `${change.sourceGeneration}:${change.activatedAt}` : null;
  if (change && activeIdentity !== evidence.activeRuleIdentity) ruleEvents.push({ kind: "activated", generation: change.activatedAt, sourceGeneration: change.sourceGeneration, revertAt: change.revertAt });
  if (!change && evidence.activeRuleIdentity) ruleEvents.push({ kind: "reverted", generation: state.generation });
  return { samples: [...evidence.samples, current], firstExtinction, peakPopulation: Math.max(evidence.peakPopulation, current.population), ruleEvents, observedRuleVersion: state.config.rules!.version, activeRuleIdentity: activeIdentity };
}
