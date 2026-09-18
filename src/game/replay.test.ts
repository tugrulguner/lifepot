import { describe, expect, it, vi } from "vitest";
import { defaultConfig, hashSetupRequest, type SetupAnswers } from "./setup";
import { createReplay, decodeReplay, encodeReplay, playReplay } from "./replay";

const answers: SetupAnswers = {
  world: "Sunlight and mineral pools are scattered across the world.",
  threat: "Heat arrives in unpredictable waves.",
  reward: "Reward reproduction and adaptation.",
};

function validReplay() {
  return createReplay({ answers, config: defaultConfig(), seed: 2026, requestHash: hashSetupRequest(answers) });
}

describe("deterministic replay contract", () => {
  it("roundtrips exact inputs, interpreted config, seed, and engine version", () => {
    const replay = validReplay();
    const encoded = encodeReplay(replay);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeReplay(encoded)).toEqual(replay);
  });

  it("replays the exact simulation and makes zero interpretation calls", async () => {
    const replay = validReplay();
    const interpreter = vi.fn(() => Promise.reject(new Error("must not run")));
    const first = await playReplay(replay, interpreter);
    const second = await playReplay(replay, interpreter);
    expect(interpreter).not.toHaveBeenCalled();
    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.state.stats).toEqual(second.state.stats);
  });

  it("rejects tampered inputs, config, request hashes, and noncanonical fitness", async () => {
    const replay = validReplay();
    await expect(playReplay({ ...replay, seed: replay.seed + 1 })).rejects.toThrow(/invalid|tamper/i);
    await expect(playReplay({ ...replay, requestHash: "wrong" })).rejects.toThrow(/invalid|tamper/i);
    await expect(playReplay({ ...replay, config: { ...replay.config, environment: { ...replay.config.environment, hazard: "toxin" } } })).rejects.toThrow(/invalid|tamper/i);
    await expect(playReplay({ ...replay, config: { ...replay.config, fitness: { ...replay.config.fitness, survive: 0.9 } } })).rejects.toThrow(/invalid|canonical/i);
  });
});
