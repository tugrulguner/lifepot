import { describe, expect, it } from "vitest";
import { defaultConfig } from "./setup";
import { interpretWorldPreview, editWorldPreview } from "./world-preview";

describe("world preview", () => {
  it("names the actual species on directional edges beyond A:B", () => {
    const config = defaultConfig();
    config.rules!.species.push({ id: "C", role: "grazer", selfInteraction: "neutral" });
    config.rules!.interactions.push({ pair: "A:C", mode: "neutral" }, { pair: "B:C", mode: "b_consumes_a" });
    const preview = interpretWorldPreview(config, { world: "three species", threat: "predation", reward: "observe" });
    expect(preview.relationships.find(edge => edge.pair === "B:C")!.description).toBe("Species C consumes species B");
  });
  it("warns when a hunter has no directional prey edge", () => {
    const config = defaultConfig();
    config.rules!.interactions[0].mode = "neutral";
    const preview = interpretWorldPreview(config, { world: "wet forest", threat: "wolves", reward: "survival" });
    expect(preview.warnings.join(" ")).toMatch(/no .*feeding link|no .*consumption link/i);
    expect(preview.relationships[0].description).toMatch(/neutral/i);
    expect(preview.stoppingRule).toMatch(/180 generations|extinction/i);
  });
  it("edits a supported pair with validated immutable config", () => {
    const original = defaultConfig();
    const edited = editWorldPreview(original, { kind: "pair", pair: "A:B", mode: "a_consumes_b" });
    expect(edited.config.rules!.interactions[0].mode).toBe("a_consumes_b");
    expect(original.rules!.interactions[0].mode).toBe("b_consumes_a");
  });
  it("rejects basal-nonviable edits without changing input", () => {
    const original = defaultConfig();
    expect(() => editWorldPreview(original, { kind: "role", species: "A", role: "hunter" })).toThrow(/basal/i);
    expect(original.rules!.species[0].role).toBe("grazer");
  });
});
