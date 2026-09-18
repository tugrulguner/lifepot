import { describe, expect, it, vi } from "vitest";
import { hashSetupRequest, type SetupAnswers } from "@/game/setup";
import { createJudgeHandler } from "./route";
import { interpretSetup } from "./service";
import { validSdkResponse } from "./setup-route.test";

const answers: SetupAnswers = { world: "Rich scattered light", threat: "Heat is stable", reward: "Reward exploration" };
const input = { answers, requestHash: hashSetupRequest(answers) };
const request = (body: unknown, ip = "203.0.113.8") => new Request("http://localhost/api/judge", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } });

describe("setup endpoint hardening", () => {
  it.each([
    ["unknown choice", { ...validSdkResponse(), answers: { ...validSdkResponse().answers, hazard: { ...validSdkResponse().answers.hazard, choice: "spider" } } }],
    ["non-finite score", { ...validSdkResponse(), answers: { ...validSdkResponse().answers, survive: { ...validSdkResponse().answers.survive, score: Number.NaN } } }],
    ["out-of-range score", { ...validSdkResponse(), answers: { ...validSdkResponse().answers, adapt: { ...validSdkResponse().answers.adapt, score: 4.1 } } }],
    ["bad probability sum", { ...validSdkResponse(), answers: { ...validSdkResponse().answers, abundance: { ...validSdkResponse().answers.abundance, probabilities: { scarce: 0.2, balanced: 0.2, rich: 0.2 } } } }],
    ["choice not probability maximum", { ...validSdkResponse(), answers: { ...validSdkResponse().answers, abundance: { ...validSdkResponse().answers.abundance, choice: "scarce", probabilities: { scarce: 0.1, balanced: 0.8, rich: 0.1 } } } }],
    ["score inconsistent with probabilities", { ...validSdkResponse(), answers: { ...validSdkResponse().answers, survive: { ...validSdkResponse().answers.survive, score: 1 } } }],
  ])("strictly rejects malformed model output via fallback: %s", async (_name, sdkResponse) => {
    const client = { systemOne: vi.fn().mockResolvedValue(sdkResponse) };
    expect((await interpretSetup(input, { apiKey: "test-key", client: client as never })).source).toBe("fallback");
  });
  it("accepts SDK score rounding within one hundredth", async () => {
    const rounded = validSdkResponse();
    rounded.answers.cooperate.score = 2.01;
    const client = { systemOne: vi.fn().mockResolvedValue(rounded) };
    expect((await interpretSetup(input, { apiKey: "test-key", client: client as never })).source).toBe("jev");
  });

  it("recomputes and validates the canonical request hash", async () => {
    const decide = vi.fn(); const handler = createJudgeHandler({ decide });
    expect((await handler(request({ ...input, requestHash: "forged-hash" }))).status).toBe(400);
    expect(decide).not.toHaveBeenCalled();
  });
  it("calls Jev for every submission and throttles excess requests", async () => {
    const decide = vi.fn(async () => interpretSetup(input)); const handler = createJudgeHandler({ decide, maxRequests: 2 });
    expect((await handler(request(input))).status).toBe(200);
    expect((await handler(request(input))).status).toBe(200);
    expect((await handler(request(input))).status).toBe(429);
    expect(decide).toHaveBeenCalledTimes(2);
  });
  it("rejects overlong text, unknown fields, and oversized bodies", async () => {
    const decide = vi.fn(); const handler = createJudgeHandler({ decide });
    expect((await handler(request({ ...input, answers: { ...answers, world: "x".repeat(141) } }))).status).toBe(400);
    expect((await handler(request({ ...input, executableRules: "eval()" }, "203.0.113.9"))).status).toBe(400);
    expect((await handler(request({ ...input, padding: "x".repeat(20_000) }, "203.0.113.10"))).status).toBe(413);
    expect(decide).not.toHaveBeenCalled();
  });
});
