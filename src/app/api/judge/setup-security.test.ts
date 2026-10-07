import { describe, expect, it, vi } from "vitest";
import { hashSetupRequest, type SetupAnswers } from "@/game/setup";
import { createJudgeHandler } from "./route";
import { interpretSetup } from "./service";
import { validSdkResponse, councilSdkResponse } from "./setup-route.test";

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
    const client = { systemOne: vi.fn().mockResolvedValueOnce(rounded).mockImplementation(councilSdkResponse) };
    expect((await interpretSetup(input, { apiKey: "test-key", client: client as never })).source).toBe("jev");
  });
  it("accepts a probability distribution rounded to 0.99", async () => {
    const rounded = validSdkResponse();
    rounded.answers.explore.score = 0.99;
    rounded.answers.explore.probabilities = { "0": 0, "1": 0.99, "2": 0, "3": 0, "4": 0 };
    const client = { systemOne: vi.fn().mockResolvedValueOnce(rounded).mockImplementation(councilSdkResponse) };
    expect((await interpretSetup(input, { apiKey: "test-key", client: client as never })).source).toBe("jev");
  });

  it("recomputes and validates the canonical request hash", async () => {
    const decide = vi.fn(); const handler = createJudgeHandler({ decide });
    expect((await handler(request({ ...input, requestHash: "forged-hash" }))).status).toBe(400);
    expect(decide).not.toHaveBeenCalled();
  });
  it("allows two full gameplay workflows of 24 provider calls within one minute", async () => {
    const decide = vi.fn(async () => interpretSetup(input));
    const handler = createJudgeHandler({ decide, now: () => 1000 });
    for (let call = 0; call < 48; call++) expect((await handler(request(input))).status).toBe(200);
    expect(decide).toHaveBeenCalledTimes(48);
  });
  it("denies provider calls above sixty and resets the fixed window", async () => {
    let now = 1000;
    const decide = vi.fn(async () => interpretSetup(input));
    const handler = createJudgeHandler({ decide, now: () => now });
    for (let call = 0; call < 60; call++) await handler(request(input));
    expect((await handler(request(input))).status).toBe(200);
    expect((await (await handler(request(input))).json()).provenance.reason).toBe("rate_limited");
    expect(decide).toHaveBeenCalledTimes(60);
    now += 60_000;
    await handler(request(input));
    expect(decide).toHaveBeenCalledTimes(61);
  });
  it("fails closed when a production rate binding denies an actual provider call", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const decide = vi.fn(async () => interpretSetup(input));
    const rateLimit = vi.fn(async () => false);
    const globalRateLimit = vi.fn(async () => true);
    try {
      const handler = createJudgeHandler({ decide, rateLimit, globalRateLimit });
      const response = await handler(request(input));
      expect((await response.json()).provenance).toEqual({ outcome: "abstained", reason: "rate_limited" });
      expect(rateLimit).toHaveBeenCalledWith("judge:unknown");
      expect(globalRateLimit).not.toHaveBeenCalled();
      expect(decide).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("calls Jev for every submission and throttles excess requests", async () => {
    const decide = vi.fn(async () => interpretSetup(input)); const handler = createJudgeHandler({ decide, maxRequests: 2 });
    expect((await handler(request(input))).status).toBe(200);
    expect((await handler(request(input))).status).toBe(200);
    const limited = await handler(request(input));
    expect(limited.status).toBe(200);
    expect((await limited.json()).source).toBe("fallback");
    expect(decide).toHaveBeenCalledTimes(2);
  });
  it("rejects overlong text, unknown fields, and oversized bodies", async () => {
    const decide = vi.fn(); const handler = createJudgeHandler({ decide });
    expect((await handler(request({ ...input, answers: { ...answers, world: "x".repeat(141) } }))).status).toBe(400);
    expect((await handler(request({ ...input, executableRules: "eval()" }, "203.0.113.9"))).status).toBe(400);
    expect((await handler(request({ ...input, padding: "x".repeat(20_000) }, "203.0.113.10"))).status).toBe(413);
    expect(decide).not.toHaveBeenCalled();
  });
  it("cancels an oversized streaming body before consuming its remainder", async () => {
    let pulls = 0; let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { pulls++; if (pulls <= 8) controller.enqueue(new Uint8Array(8192)); else controller.close(); },
      cancel() { canceled = true; },
    });
    const res = await createJudgeHandler({ decide: vi.fn() })(new Request("http://localhost/api/judge", { method: "POST", body, duplex: "half" } as RequestInit & { duplex: "half" }));
    expect(res.status).toBe(413);
    expect(pulls).toBeLessThan(4);
    expect(canceled).toBe(true);
  });
});
