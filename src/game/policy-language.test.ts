import { describe, expect, it } from "vitest";
import { strategyMeaning, rulePatchMeaning } from "./policy-language";
import { PREY_STRATEGIES, PREDATOR_STRATEGIES } from "./decisions";
import type { RulePatch } from "./rules";

describe("recorded policy language", () => {
  it("explains the bounded engine meaning of every supported birth strategy", () => {
    const meanings = [...PREY_STRATEGIES, ...PREDATOR_STRATEGIES].map(strategyMeaning);
    expect(meanings).toHaveLength(PREY_STRATEGIES.length + PREDATOR_STRATEGIES.length);
    for (const meaning of meanings) {
      expect(meaning.length).toBeGreaterThan(25);
      expect(meaning).not.toMatch(/^[a-z]+_[a-z]+$/);
      expect(meaning).not.toMatch(/guarantees|ensures|will survive|will succeed/i);
    }
    expect(strategyMeaning("early_brood")).toMatch(/lower energy threshold/i);
    expect(strategyMeaning("efficient_grazing")).toMatch(/more resource energy per feeding/i);
    expect(strategyMeaning("armored")).toMatch(/hazard damage/i);
    expect(strategyMeaning("swarming")).toMatch(/same-species neighbors/i);
    expect(strategyMeaning("swarming")).toMatch(/maintenance stays fixed at 1 energy/i);
    expect(strategyMeaning("swarming")).toMatch(/attack cost that grows with the defender's neighbor count/i);
    expect(strategyMeaning("swarming")).not.toMatch(/upkeep.*rise.*group/i);
    expect(strategyMeaning("dispersal")).toMatch(/may move/i);
    expect(strategyMeaning("ambush")).toMatch(/nearby cells/i);
    expect(strategyMeaning("pursuit")).toMatch(/farther/i);
    expect(strategyMeaning("pack_hunting")).toMatch(/farther/i);
    expect(strategyMeaning("efficient_kill")).toMatch(/captured prey energy/i);
    expect(strategyMeaning("brood_hunting")).toMatch(/oldest lineage generation/i);
  });

  it("describes every permitted graph patch value without mutating it", () => {
    const patches: RulePatch[] = [
      ...(["cooperative", "territorial", "cannibalistic", "neutral"] as const).map((value) => ({ kind: "self" as const, species: "A" as const, value })),
      ...(["a_consumes_b", "b_consumes_a", "competition", "mutualism", "avoidance", "neutral"] as const).map((mode) => ({ kind: "pair" as const, pair: "A:B" as const, mode })),
      ...(["steady", "pulsed", "depletion_feedback"] as const).map((value) => ({ kind: "environment" as const, field: "regeneration" as const, value })),
      ...(["stability", "drought", "toxin_wave", "heat_wave", "fragmentation", "nutrient_bloom"] as const).map((value) => ({ kind: "environment" as const, field: "pressure" as const, value })),
      ...(["stable", "pulsing", "chaotic"] as const).map((value) => ({ kind: "environment" as const, field: "volatility" as const, value })),
      ...(["low", "medium", "high"] as const).map((value) => ({ kind: "environment" as const, field: "intensity" as const, value })),
      ...(["short", "medium", "long", "persistent"] as const).map((value) => ({ kind: "environment" as const, field: "duration" as const, value })),
    ];
    const before = structuredClone(patches);
    const meanings = patches.map(rulePatchMeaning);
    expect(meanings).toHaveLength(patches.length);
    for (const meaning of meanings) {
      expect(meaning.length).toBeGreaterThan(15);
      expect(meaning).not.toMatch(/^[a-z]+_[a-z]+$/);
      expect(meaning).not.toMatch(/guarantees|ensures|will survive|will succeed/i);
    }
    expect(rulePatchMeaning(patches[5])).toMatch(/species B can feed on species A/i);
    expect(patches).toEqual(before);
  });});
