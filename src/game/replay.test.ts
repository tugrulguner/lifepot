import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createReplay, decodeReplay, encodeReplay, playReplay, replayCounterfactual } from "./replay";
import { defaultConfig, hashSetupRequest } from "./setup";
import { createSimulation } from "./world";
import { runFreshWithDecisions } from "./runtime";
import { deterministicEvolutionDecision } from "./decisions";

const answers = { world: "rich plains", threat: "drought", reward: "coexist" };

describe("replay v3", () => {
  it("roundtrips a complete event ledger and makes no calls", async () => {
    const config = defaultConfig();
    const seed = 19;
    const fresh = await runFreshWithDecisions(createSimulation({ seed, config }), answers, async (summary) =>
      deterministicEvolutionDecision(summary),
    );
    const replay = createReplay({ answers, config, seed, requestHash: hashSetupRequest(answers), ledger: fresh.ledger });
    const decoded = decodeReplay(encodeReplay(replay));
    const call = vi.fn();
    expect(decoded.version).toBe(3);
    await playReplay(decoded, call);
    expect(call).not.toHaveBeenCalled();
  }, 10_000);

  it("preserves the supplied ca7 replay bit-for-bit and final species counts", async () => {
    const legacy = JSON.parse(readFileSync(new URL("./fixtures/ca7-replay.json", import.meta.url), "utf8"));
    const replay = decodeReplay(encodeReplay(legacy));
    const { snapshot } = await playReplay(replay);
    expect(replay.engineVersion).toBe("lifepot-ca-7");
    expect(snapshot.engineVersion).toBe("lifepot-ca-7");
    expect({ A: Array.from(snapshot.ruleSpecies).filter((slot: number) => slot === 1).length, B: Array.from(snapshot.ruleSpecies).filter((slot: number) => slot === 2).length }).toEqual({ A: 2427, B: 0 });
    const corrected = replayCounterfactual(replay);
    expect(corrected.engineVersion).toBe("lifepot-ca-8");
    expect({ generation: corrected.generation, outcome: corrected.outcome, prey: corrected.stats.prey, predators: corrected.stats.predators, population: corrected.stats.population }).toEqual({ generation: 180, outcome: "surviving", prey: 1340, predators: 0, population: 1340 });
    expect(replay.ledger).toEqual(legacy.ledger);
  }, 15_000);

  it("rejects legacy versions", () => expect(() => decodeReplay(btoa(JSON.stringify({ version: 2 })))).toThrow(/invalid|unsupported/i));
});
