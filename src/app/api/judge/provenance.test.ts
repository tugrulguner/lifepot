import { describe, expect, it } from "vitest";
import { createJudgeHandler } from "./route";
import { hashSetupRequest } from "@/game/setup";

describe("judge fallback provenance", () => {
  it("returns safe classified reason when protected model calls are denied", async () => {
    const answers = { world: "Two distinct grazers", threat: "No predators", reward: "Cooperation" };
    const handler = createJudgeHandler({ decide: async () => { throw new Error("Quota exceeded"); }, rateLimit: async () => false, globalRateLimit: async () => true });
    const response = await handler(new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify({ answers, requestHash: hashSetupRequest(answers) }) }));
    const result = await response.json();
    expect(result.source).toBe("fallback");
    expect(result.provenance).toEqual({ outcome: "abstained", reason: "rate_limited" });
  });
});
