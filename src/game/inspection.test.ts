import { describe, expect, it } from "vitest";
import { cellAtPoint, inspectCell, lineageCells } from "./inspection";
import { createSimulation } from "./world";
import { deterministicSetup } from "./setup";
const config = deterministicSetup({ world: "rich nutrients", threat: "stable", reward: "replicate" });
describe("organism inspection", () => {
  it("maps taps to exact cells and rejects the canvas padding", () => {
    expect(cellAtPoint(18, 18, 536, 536)).toBe(0);
    expect(cellAtPoint(517, 517, 536, 536)).toBe(2499);
    expect(cellAtPoint(518, 20, 536, 536)).toBeNull();
    expect(cellAtPoint(17, 20, 536, 536)).toBeNull();
  });
  it("reads actual graph diet, inherited traits and living founder families", () => {
    const state = createSimulation({ seed: 4, config });
    const index = state.guild.findIndex(Boolean);
    const result = inspectCell(state, index);
    expect(result.energy).toBe(state.energy[index]);
    expect(result.species).toEqual(state.config.rules!.species[state.ruleSpecies[index] - 1]);
    expect(result.traits.map(t => t.value)).toEqual(Array.from(state.traits.slice(index * 5, index * 5 + 5)));
    expect(lineageCells(state, state.lineage[index])).toContain(index);
    state.guild[index] = 0;
    expect(inspectCell(state, index).occupied).toBe(false);
    expect(lineageCells(state, state.lineage[index])).not.toContain(index);
  });
});
