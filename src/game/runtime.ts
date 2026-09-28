import { DEFAULT_GENERATIONS, stepSimulation, type SimulationState } from "./world";
import {
  decisionEpochAt,
  deterministicEpochDecision,
  summarizeEpochState,
  validateEpochDecision,
  type EpochDecision,
  type EpochLedger,
  type EpochStateSummary,
} from "./decisions";
import type { SetupAnswers } from "./setup";

export type EpochDecider = (summary: EpochStateSummary) => Promise<unknown>;

export function validateEpochLedger(input: unknown): EpochLedger {
  if (!Array.isArray(input)) throw new Error("Invalid epoch decision ledger");
  const ledger = input.map(validateEpochDecision);
  for (let index = 0; index < ledger.length; index += 1) {
    if (index > 0 && ledger[index - 1].generation >= ledger[index].generation) throw new Error("Invalid epoch decision ledger");
  }
  return ledger;
}

export function activeDecisionForGeneration(ledger: readonly EpochDecision[], generation: number): EpochDecision | undefined {
  let active: EpochDecision | undefined;
  for (const decision of ledger) {
    if (decision.generation > generation) break;
    active = decision;
  }
  return active;
}

export function advanceUntilDecisionEpoch(state: SimulationState, ledger: readonly EpochDecision[], maxSteps: number): SimulationState {
  let next = state;
  const steps = Math.max(0, Math.floor(maxSteps));
  for (let index = 0; index < steps && next.outcome === "running"; index += 1) {
    const epoch = decisionEpochAt(next.generation);
    if (epoch !== null && !ledger.some((decision) => decision.generation === epoch)) break;
    const active = activeDecisionForGeneration(ledger, next.generation);
    if (!active) break;
    next = stepSimulation(next, active);
  }
  return next;
}

export async function runFreshWithDecisions(initial: SimulationState, intent: SetupAnswers, decide: EpochDecider, generations = DEFAULT_GENERATIONS): Promise<{ state: SimulationState; ledger: EpochLedger }> {
  let state = initial; const ledger: EpochLedger = []; let active: EpochDecision | undefined;
  const target = Math.min(DEFAULT_GENERATIONS, state.generation + Math.max(0, Math.floor(generations)));
  while (state.generation < target && state.outcome === "running") {
    const epoch = decisionEpochAt(state.generation);
    if (epoch !== null) {
      const summary = summarizeEpochState(state, intent);
      try {
        const candidate = validateEpochDecision(await decide(summary));
        active = candidate.generation === epoch ? candidate : deterministicEpochDecision(summary);
      } catch {
        active = deterministicEpochDecision(summary);
      }
      ledger.push(active);
    }
    state = stepSimulation(state, active);
  }
  return { state, ledger };
}

export function runWithDecisionLedger(initial: SimulationState, input: unknown, generations = DEFAULT_GENERATIONS): SimulationState {
  const ledger = validateEpochLedger(input); let state = initial; let active: EpochDecision | undefined;
  const target = Math.min(DEFAULT_GENERATIONS, state.generation + Math.max(0, Math.floor(generations)));
  while (state.generation < target && state.outcome === "running") {
    const epoch = decisionEpochAt(state.generation);
    if (epoch !== null) {
      active = ledger.find((decision) => decision.generation === epoch);
      if (!active) throw new Error(`Replay is missing epoch ${epoch}`);
    }
    state = stepSimulation(state, active);
  }
  return state;
}
