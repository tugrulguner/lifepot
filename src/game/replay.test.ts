import { describe, expect, it, vi } from "vitest";
import { createReplay, decodeReplay, encodeReplay, playReplay } from "./replay";
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

  it("rejects legacy versions", () => expect(() => decodeReplay(btoa(JSON.stringify({ version: 2 })))).toThrow(/invalid|unsupported/i));
});
