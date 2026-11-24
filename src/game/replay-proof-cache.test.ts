import { beforeEach, describe, expect, it, vi } from "vitest";

const runs = vi.hoisted(() => ({ count: 0 }));
vi.mock("./runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./runtime")>();
  return {
    ...actual,
    runWithDecisionLedger: (...args: Parameters<typeof actual.runWithDecisionLedger>) => {
      runs.count++;
      return actual.runWithDecisionLedger(...args);
    },
  };
});

import { deterministicEvolutionDecision } from "./decisions";
import { createReplay, decodeReplay, encodeReplay, encodeReplayLink, decodeReplayLink, playReplay } from "./replay";
import { runFreshWithDecisions } from "./runtime";
import { defaultConfig, hashReplayPayload, hashSetupRequest } from "./setup";
import { createSimulation } from "./world";

const intent = { world: "pond", threat: "drought", reward: "observe" };
async function finishedInput(seed: number) {
  const config = defaultConfig();
  const { ledger } = await runFreshWithDecisions(createSimulation({ seed, config }), intent, async (summary) =>
    deterministicEvolutionDecision(summary),
  );
  return { answers: intent, config, seed, requestHash: hashSetupRequest(intent), ledger };
}

describe("replay proof cache", () => {
  beforeEach(() => {
    runs.count = 0;
  });

  it("simulates a finished run once across create, encode, decode and playback", async () => {
    const input = await finishedInput(31);
    runs.count = 0;
    const replay = createReplay(input);
    expect(runs.count).toBe(1);
    // Saving a world encodes the replay and decodes it into a new object; a link does the same.
    const decoded = decodeReplay(encodeReplay(replay));
    expect(decoded).not.toBe(replay);
    expect(await decodeReplayLink(await encodeReplayLink(decoded))).toEqual(replay);
    await playReplay(decoded);
    expect(runs.count).toBe(1);
  }, 30_000);

  it("simulates again when the recorded content differs", async () => {
    const input = await finishedInput(32);
    const replay = createReplay(input);
    runs.count = 0;
    // A different seed with a recomputed contract hash is a different recording, not a cache hit.
    const { contractHash: _unused, ...rest } = structuredClone(replay);
    void _unused;
    const other = { ...rest, seed: rest.seed + 1 };
    try {
      decodeReplay(encodeReplayPlain({ ...other, contractHash: hashReplayPayload(other) }));
    } catch {
      // The other seed need not accept this ledger; it only has to be simulated to find out.
    }
    expect(runs.count).toBe(1);
  }, 30_000);
});

function encodeReplayPlain(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
