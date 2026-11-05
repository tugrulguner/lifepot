import { createSimulation, DEFAULT_GENERATIONS, ENGINE_VERSION, stepSimulation, type CreateSimulationOptions, type SimulationState } from "./world";

export const MAX_FIXED_HABITAT_GENERATIONS = 1800;
export type FixedHabitatOptions = Omit<CreateSimulationOptions, "engineVersion" | "fixedHabitat"> & { observationLimit?: number };

function validLimit(limit: number): boolean {
  return Number.isInteger(limit) && limit > 0 && limit <= MAX_FIXED_HABITAT_GENERATIONS;
}

function assertFixedHabitat(state: SimulationState): asserts state is SimulationState & { fixedHabitat: { version: 1; observationLimit: number } } {
  if (!state.fixedHabitat || state.engineVersion !== ENGINE_VERSION || state.fixedHabitat.version !== 1) throw new Error("Unsupported fixed habitat state");
  if (!validLimit(state.fixedHabitat.observationLimit)) throw new Error("Invalid fixed habitat observation limit");
  if (state.activeRuleChange || state.appliedRuleChanges.length || state.maintainedRuleChanges.length) throw new Error("Fixed habitats cannot contain adaptive rule changes");
}

export function createFixedHabitat(options: FixedHabitatOptions): SimulationState {
  const observationLimit = options.observationLimit ?? DEFAULT_GENERATIONS;
  if (!validLimit(observationLimit)) throw new Error("Invalid fixed habitat observation limit");
  return createSimulation({ seed: options.seed, config: options.config, engineVersion: ENGINE_VERSION, fixedHabitat: { version: 1, observationLimit }, ...(options.initialPopulation ? { initialPopulation: options.initialPopulation } : {}), ...(options.initialResources ? { initialResources: options.initialResources } : {}) });
}

export function getObservationLimit(state: SimulationState): number {
  return state.fixedHabitat?.observationLimit ?? DEFAULT_GENERATIONS;
}

export function extendFixedHabitat(state: SimulationState, newLimit: number): SimulationState {
  if (!validLimit(newLimit)) throw new Error("Invalid fixed habitat observation limit");
  assertFixedHabitat(state);
  if (state.outcome === "extinct") throw new Error("Cannot extend an extinct habitat");
  if (newLimit <= state.fixedHabitat.observationLimit) throw new Error("Fixed habitat extension must increase the observation limit");
  return {
    ...state,
    fixedHabitat: { ...state.fixedHabitat, observationLimit: newLimit },
    outcome: state.outcome === "surviving" || state.outcome === "thriving" ? "running" : state.outcome,
  };
}

export function advanceFixedHabitat(state: SimulationState, count: number, onStep?: (state: SimulationState) => void): SimulationState {
  assertFixedHabitat(state);
  if (!Number.isInteger(count) || count < 0) throw new Error("Step count must be a non-negative integer");
  let next: SimulationState = state;
  for (let i = 0; i < count && next.outcome === "running" && next.generation < getObservationLimit(next); i += 1) {
    const priorGeneration = next.generation;
    next = stepSimulation(next);
    if (next.generation !== priorGeneration) onStep?.(next);
  }
  return next;
}
