import { describe, expect, it } from "vitest";
import { defaultConfig } from "./setup";
import { createSimulation, runSimulation, stepSimulation, snapshotSimulation } from "./world";
import { advanceFixedHabitat, createFixedHabitat, extendFixedHabitat, getObservationLimit, MAX_FIXED_HABITAT_GENERATIONS } from "./fixed-habitat";
import { advanceUntilDecisionTrigger, detectDecisionTriggerForRun, playerProposalAvailability, runFreshWithDecisions, runWithDecisionLedger, stepWithPlayerEvents } from "./runtime";

describe("fixed habitat bounded continuity", () => {
  it("rejects future adaptive histories before a fixed runner takes any steps", () => {
    const habitat = createFixedHabitat({ seed: 31, config: defaultConfig() });
    const before = structuredClone(habitat);
    // Deliberately unsupported future entry: fixed mode rejects all ledger entries,
    // not just entries that have reached the current generation.
    const ledger = [{ generation: 12 } as never];
    expect(() => detectDecisionTriggerForRun(habitat, ledger)).toThrow(/fixed habitat/i);
    expect(() => advanceUntilDecisionTrigger(habitat, ledger, 3)).toThrow(/fixed habitat/i);
    expect(habitat).toStrictEqual(before);
  });
  it.each([0, 1801, Number.NaN, Number.POSITIVE_INFINITY, 1.5])("rejects a corrupted observation limit %s at the public stepping boundary", observationLimit => {
    const state = { ...createFixedHabitat({ seed: 31, config: defaultConfig() }), fixedHabitat: { version: 1 as const, observationLimit } };
    const before = structuredClone(state);
    expect(() => stepSimulation(state)).toThrow(/fixed habitat|observation/i);
    expect(state).toStrictEqual(before);
  });
  it("opts into a ca8 world with a default 180-generation observation window", () => {
    const habitat = createFixedHabitat({ seed: 41, config: defaultConfig() });
    expect(habitat.engineVersion).toBe("lifepot-ca-8");
    expect(habitat.fixedHabitat).toEqual({ version: 1, observationLimit: 180 });
    expect(getObservationLimit(habitat)).toBe(180);
    expect("fixedHabitat" in createSimulation({ seed: 41, config: defaultConfig() })).toBe(false);
  });

  it("preserves the full deterministic world across a short explicit observation extension", () => {
    const extended = createFixedHabitat({ seed: 41, config: defaultConfig(), observationLimit: 10 });
    const direct = createFixedHabitat({ seed: 41, config: defaultConfig(), observationLimit: 20 });
    const atBoundary = advanceFixedHabitat(extended, 10);
    const continued = advanceFixedHabitat(extendFixedHabitat(atBoundary, 20), 10);
    const full = advanceFixedHabitat(direct, 20);
    expect(continued.generation).toBe(20);
    expect(continued).toStrictEqual(full);
  });

  it("calls onStep exactly once for every completed simulation step", () => {
    const seen: number[] = [];
    const advanced = advanceFixedHabitat(createFixedHabitat({ seed: 8, config: defaultConfig(), observationLimit: 5 }), 10, state => seen.push(state.generation));
    expect(advanced.generation).toBe(5);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it("validates the cap without starting a long run", () => {
    expect(MAX_FIXED_HABITAT_GENERATIONS).toBe(1800);
    expect(() => createFixedHabitat({ seed: 1, config: defaultConfig(), observationLimit: 0 })).toThrow();
    expect(() => createFixedHabitat({ seed: 1, config: defaultConfig(), observationLimit: 1801 })).toThrow();
    expect(() => createFixedHabitat({ seed: 1, config: defaultConfig(), observationLimit: 1.5 })).toThrow();
    expect(() => createSimulation({ seed: 1, config: defaultConfig(), engineVersion: "lifepot-ca-7", fixedHabitat: { version: 1, observationLimit: 180 } })).toThrow();
    const baseline = createFixedHabitat({ seed: 1, config: defaultConfig() });
    expect(() => extendFixedHabitat(baseline, 180)).toThrow();
    expect(getObservationLimit(createSimulation({ seed: 1, config: defaultConfig() }))).toBe(180);
  });

  it("keeps legacy stop behavior and default state shape unchanged", () => {
    const legacy = createSimulation({ seed: 41, config: defaultConfig() });
    const atLegacyBoundary = runSimulation(legacy, 180);
    expect(atLegacyBoundary.generation).toBe(180);
    expect(stepSimulation(atLegacyBoundary).generation).toBe(180);
    expect("fixedHabitat" in legacy).toBe(false);
  });

  it("disables decision triggers and player authority for fixed habitats", () => {
    const habitat = createFixedHabitat({ seed: 10, config: defaultConfig() });
    expect(detectDecisionTriggerForRun(habitat, [])).toBeNull();
    expect(String(playerProposalAvailability({ state: habitat, ledger: [] })).toLowerCase()).toContain("fixed habitat");
  });

  it("does not invoke inference from the adaptive fresh runner for a fixed habitat", async () => {
    let inferenceCalls = 0;
    const result = await runFreshWithDecisions(createFixedHabitat({ seed: 10, config: defaultConfig() }), { world: "x", threat: "y", reward: "z" }, async () => { inferenceCalls += 1; return {}; }, 3);
    expect(inferenceCalls).toBe(0);
    expect(result.ledger).toEqual([]);
    expect(result.state.generation).toBe(3);
  });

  it("rejects player events and adaptive replay on fixed habitats before changing input", () => {
    const habitat = createFixedHabitat({ seed: 10, config: defaultConfig() });
    const before = snapshotSimulation(habitat);
    expect(() => stepWithPlayerEvents(habitat, [], [{}] as never)).toThrow(/fixed habitat/i);
    expect(() => runWithDecisionLedger(habitat, [{}])).toThrow(/fixed habitat/i);
    expect(snapshotSimulation(habitat)).toEqual(before);
  });

  it("resets only window metadata and outcome when extending a completed living habitat", () => {
    const completed = advanceFixedHabitat(createFixedHabitat({ seed: 20, config: defaultConfig(), observationLimit: 3 }), 3);
    const extended = extendFixedHabitat(completed, 5);
    expect(completed.outcome).toMatch(/surviving|thriving/);
    expect(extended.outcome).toBe("running");
    expect(extended.fixedHabitat).toEqual({ version: 1, observationLimit: 5 });
    expect({ ...extended, fixedHabitat: completed.fixedHabitat, outcome: completed.outcome }).toEqual(completed);
  });

  it("rejects extension of extinct, legacy, and invalid-window states without mutation", () => {
    const extinct = createFixedHabitat({ seed: 20, config: defaultConfig(), initialPopulation: [] });
    const legacy = { ...createFixedHabitat({ seed: 21, config: defaultConfig() }), engineVersion: "lifepot-ca-7" as const };
    const before = snapshotSimulation(extinct);
    expect(extinct.outcome).toBe("extinct");
    expect(() => extendFixedHabitat(extinct, 360)).toThrow();
    expect(() => extendFixedHabitat(legacy, 360)).toThrow();
    expect(() => extendFixedHabitat(createFixedHabitat({ seed: 22, config: defaultConfig() }), 1801)).toThrow();
    expect(snapshotSimulation(extinct)).toEqual(before);
  });

  it("rejects decision and pressure overrides before mutating a fixed state", () => {
    const habitat = createFixedHabitat({ seed: 31, config: defaultConfig() });
    const before = snapshotSimulation(habitat);
    expect(() => stepSimulation(habitat, {} as never)).toThrow(/fixed habitat/i);
    expect(() => stepSimulation(habitat, undefined, [], { pressure: "drought", power: 1 })).toThrow(/fixed habitat/i);
    expect(snapshotSimulation(habitat)).toEqual(before);
  });

  it("rejects a fixed habitat carrying adaptive effects before extending or stepping", () => {
    const habitat = createFixedHabitat({ seed: 25, config: defaultConfig() });
    const contaminated = { ...habitat, activeRuleChange: { sourceGeneration: 0, activatedAt: 0, revertAt: null, previousRules: structuredClone(habitat.config.rules!) } };
    const before = snapshotSimulation(contaminated);
    expect(() => extendFixedHabitat(contaminated, 360)).toThrow(/adaptive|active/i);
    expect(() => stepSimulation(contaminated)).toThrow(/adaptive|active/i);
    expect(snapshotSimulation(contaminated)).toEqual(before);
  });
});
