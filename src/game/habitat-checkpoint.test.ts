import { deepStrictEqual } from "node:assert";
import { describe, expect, it } from "vitest";
import { createSimulation } from "./world";
import { createFixedHabitat, advanceFixedHabitat } from "./fixed-habitat";
import { defaultConfig } from "./setup";
import { createRunEvidence, followRunLineage, observeRun } from "./run-evidence";
import { createHabitatCheckpoint, decodeHabitatCheckpoint, encodeHabitatCheckpoint } from "./habitat-checkpoint";

function pausedWorld() {
  let state = createFixedHabitat({ seed: 241, config: defaultConfig() });
  let evidence = createRunEvidence(state);
  const cell = state.guild.findIndex(value => value !== 0);
  evidence = followRunLineage(evidence, state, state.lineage[cell]);
  state = advanceFixedHabitat(state, 3, next => { evidence = observeRun(evidence, next); });
  return { state, evidence };
}

describe("exact fixed habitat checkpoints", () => {
  it.each(["hidden-field", "symbol", "array-property"])("rejects unsupported own property %s instead of silently losing it", defect => {
    const checkpoint = createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Pond family", createdAt: 100, savedAt: 200, parentId: null, ...pausedWorld() });
    if (defect === "hidden-field") Object.defineProperty(checkpoint.state, "hiddenField", { value: 1 });
    if (defect === "symbol") Object.assign(checkpoint.state, { [Symbol("unsupported")]: 1 });
    if (defect === "array-property") Object.assign(checkpoint.state.energy, { unsupported: 1 });
    expect(() => encodeHabitatCheckpoint(checkpoint)).toThrow(/checkpoint|property|value/i);
    expect(() => createHabitatCheckpoint(checkpoint)).toThrow(/checkpoint|property|value/i);
  });
  it("rejects an invalid rule graph even when the stored species samples match it", () => {
    const checkpoint = createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Pond family", createdAt: 100, savedAt: 200, parentId: null, ...pausedWorld() });
    checkpoint.state.config.rules!.species[1].id = "A";
    for (const sample of checkpoint.evidence.samples) sample.species[1].speciesId = "A";
    expect(() => encodeHabitatCheckpoint(checkpoint)).toThrow(/checkpoint|state|rule/i);
  });
  it("rejects unknown envelope fields rather than ignoring them", () => {
    const checkpoint = createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Pond family", createdAt: 100, savedAt: 200, parentId: null, ...pausedWorld() });
    const envelope = JSON.parse(encodeHabitatCheckpoint(checkpoint));
    expect(() => decodeHabitatCheckpoint(JSON.stringify({ ...envelope, ignoredPrivateField: "not part of this format" }))).toThrow(/checkpoint|format/i);
  });
  it("rejects oversized input before parsing it", () => {
    expect(() => decodeHabitatCheckpoint(" ".repeat(8 * 1024 * 1024 + 1))).toThrow(/size|large/i);
  });
  it("rejects excessive wire nesting before JSON parsing or restoring", () => {
    expect(() => decodeHabitatCheckpoint("[".repeat(1000) + "0" + "]".repeat(1000))).toThrow(/depth|nest/i);
  });
  it("preserves recorded inhabitant names and setup provenance for a returning world", () => {
    const data = pausedWorld();
    const input = { id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Pond family", createdAt: 100, savedAt: 200, parentId: null, ...data, setup: { source: "fallback" as const, starter: true, namedIntent: { species: data.state.config.rules!.species.map((species, index) => ({ id: species.id, role: species.role, name: `Pond inhabitant ${index + 1}` })) } } };
    const checkpoint = createHabitatCheckpoint(input);
    const restored = decodeHabitatCheckpoint(encodeHabitatCheckpoint(checkpoint));
    expect(restored.setup?.namedIntent).toEqual(input.setup.namedIntent);
    deepStrictEqual(restored, checkpoint);
  });
  it.each(["version", "private-field", "generation", "evidence", "outcome"])("rejects inconsistent checkpoint %s before serializing", defect => {
    const checkpoint = createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Pond family", createdAt: 100, savedAt: 200, parentId: null, ...pausedWorld() });
    if (defect === "version") (checkpoint as { version: number }).version = 2;
    if (defect === "private-field") Object.assign(checkpoint, { privateQuestion: "must not escape through an unknown field" });
    if (defect === "generation") checkpoint.state.generation += 1;
    if (defect === "evidence") checkpoint.evidence.samples.at(-1)!.population = 0;
    if (defect === "outcome") checkpoint.state.outcome = "extinct";
    expect(() => encodeHabitatCheckpoint(checkpoint)).toThrow(/checkpoint|state|version/i);
  });
  it.each(["constructor", "length", "non-finite"])("rejects malformed state array %s even before export", defect => {
    const { state, evidence } = pausedWorld();
    if (defect === "constructor") state.energy = new Uint8Array(state.energy.length) as never;
    if (defect === "length") state.energy = new Float32Array(1);
    if (defect === "non-finite") state.energy[0] = Number.NaN;
    const before = structuredClone(state);
    expect(() => createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Pond family", createdAt: 100, savedAt: 200, parentId: null, state, evidence })).toThrow(/checkpoint|state|array/i);
    deepStrictEqual(state, before);
  });
  it("detects changed metadata instead of restoring a damaged backup", () => {
    const checkpoint = createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Pond family", createdAt: 100, savedAt: 200, parentId: null, ...pausedWorld() });
    const encoded = encodeHabitatCheckpoint(checkpoint);
    expect(encoded.includes("Pond family")).toBe(true);
    expect(() => decodeHabitatCheckpoint(encoded.replace("Pond family", "Changed pond"))).toThrow(/integrity|checksum/i);
  });
  it("rejects a legacy world rather than relabeling it as resumable", () => {
    const state = createSimulation({ seed: 241, config: defaultConfig() });
    const before = structuredClone(state);
    expect(() => createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Legacy world", createdAt: 100, savedAt: 200, parentId: null, state, evidence: createRunEvidence(state) })).toThrow(/fixed habitat/i);
    deepStrictEqual(state, before);
  });
  it("round-trips every state field and continues identically without reconstructing from replay", () => {
    const { state, evidence } = pausedWorld();
    const checkpoint = createHabitatCheckpoint({ id: "61c539c3-ef4d-4425-a567-803a89d3e099", name: "Pond family", createdAt: 100, savedAt: 200, parentId: null, state, evidence });
    const restored = decodeHabitatCheckpoint(encodeHabitatCheckpoint(checkpoint));
    // Check constructor loss with bounded diagnostics before asking the runner
    // to format a complete snapshot difference (which can overwhelm its printer).
    expect(restored.state.energy instanceof Float32Array).toBe(true);
    expect(restored.state.organismId instanceof Uint32Array).toBe(true);
    deepStrictEqual(restored, checkpoint);
    expect(Object.hasOwn(restored.state, "activeRuleChange")).toBe(Object.hasOwn(checkpoint.state, "activeRuleChange"));
    deepStrictEqual(advanceFixedHabitat(restored.state, 3), advanceFixedHabitat(checkpoint.state, 3));
    expect(restored.state.generation).toBe(3);
    expect(restored.evidence.followedFamily).toEqual(evidence.followedFamily);
  });
});
