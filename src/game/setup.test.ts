import { describe, expect, it } from "vitest";
import { deterministicSetup } from "./setup";

describe("deterministicSetup", () => {
  it("interprets the public rich-oases example without treating few oases as scarce resources", () => {
    const config = deterministicSetup({
      world: "Rich mineral pools clustered in a few oases",
      threat: "Toxic waves sweep across the world in pulses",
      reward: "Replicate quickly, even if individuals live shorter lives.",
    });

    expect(config.environment).toEqual({
      abundance: "rich",
      distribution: "clustered",
      hazard: "toxin",
      volatility: "pulsing",
    });
    expect(config.fitness.replicate).toBeGreaterThan(config.fitness.survive);
  });

  it("maps predator language to the predator mechanic instead of an unrelated hazard", () => {
    const config = deterministicSetup({
      world: "Scattered nutrients across a broad plain",
      threat: "Fast predators hunt isolated cells in recurring packs",
      reward: "Cooperate and protect the colony",
    });
    expect(config.environment.hazard).toBe("predator");
    expect(config.environment.volatility).toBe("pulsing");
    expect(config.fitness.cooperate).toBeGreaterThan(config.fitness.explore);
  });
});
