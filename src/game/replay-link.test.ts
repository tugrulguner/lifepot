import { describe, expect, it } from "vitest";
import { deterministicEvolutionDecision } from "./decisions";
import { createReplay, decodeReplay, decodeReplayLink, encodeReplay, encodeReplayLink } from "./replay";
import { runFreshWithDecisions } from "./runtime";
import { defaultConfig, hashSetupRequest } from "./setup";
import { createSimulation } from "./world";

const intent = { world: "pond", threat: "drought", reward: "observe" };
async function finishedReplay() {
  const config = defaultConfig(),
    seed = 21;
  const { ledger } = await runFreshWithDecisions(createSimulation({ seed, config }), intent, async (summary) =>
    deterministicEvolutionDecision(summary),
  );
  return createReplay({ answers: intent, config, seed, requestHash: hashSetupRequest(intent), ledger });
}

describe("compact replay share links", () => {
  it("round-trips a finished run in a fraction of the plain payload", async () => {
    const replay = await finishedReplay();
    const plain = encodeReplay(replay),
      compact = await encodeReplayLink(replay);
    expect(compact.startsWith("z1.")).toBe(true);
    expect(compact).toMatch(/^z1\.[A-Za-z0-9_-]+$/);
    expect(compact.length).toBeLessThan(plain.length / 3);
    expect(await decodeReplayLink(compact)).toEqual(decodeReplay(plain));
  }, 30_000);

  it("still accepts plain payloads from earlier links", async () => {
    const replay = await finishedReplay();
    expect(await decodeReplayLink(encodeReplay(replay))).toEqual(replay);
  }, 30_000);

  it("rejects corrupted, truncated and tampered compact payloads", async () => {
    const replay = await finishedReplay();
    const compact = await encodeReplayLink(replay);
    await expect(decodeReplayLink("z1.not-deflate")).rejects.toThrow(/invalid|unsupported/i);
    await expect(decodeReplayLink(compact.slice(0, compact.length - 40))).rejects.toThrow(/invalid|unsupported/i);
    const tampered = await encodeReplayLink(replay).then(async () => {
      const copy = structuredClone(replay);
      copy.seed += 1;
      const bytes = new TextEncoder().encode(JSON.stringify(copy));
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const deflated = new Uint8Array(await new Response(stream).arrayBuffer());
      return "z1." + Buffer.from(deflated).toString("base64url");
    });
    await expect(decodeReplayLink(tampered)).rejects.toThrow(/invalid|unsupported/i);
  }, 30_000);

  it("refuses a payload that inflates past the size bound", async () => {
    const bytes = new Uint8Array(400_000).fill(0x20);
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bomb = "z1." + Buffer.from(new Uint8Array(await new Response(stream).arrayBuffer())).toString("base64url");
    await expect(decodeReplayLink(bomb)).rejects.toThrow(/invalid|unsupported/i);
  });

  it("does not let a mutated replay reuse an earlier proof", async () => {
    const replay = await finishedReplay();
    expect(() => encodeReplay(replay)).not.toThrow();
    replay.seed += 1;
    expect(() => encodeReplay(replay)).toThrow(/invalid|tampered/i);
  }, 30_000);
});
