import { afterEach, expect, it, vi } from "vitest";
import { createJudgeHandler } from "./route";
import { defaultConfig, hashSetupRequest } from "@/game/setup";

const answers = { world: "A pond", threat: "Seasonal drought", reward: "Survival" };
const input = { answers, requestHash: hashSetupRequest(answers) };
const request = (host = "localhost") => new Request(`http://${host}/api/judge`, { method: "POST", body: JSON.stringify(input) });
afterEach(() => vi.unstubAllEnvs());
function localEnvironment() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("LIFEPOT_SHOWCASE_MODE", "1");
}
function fixture() {
  const decide = vi.fn(async () => ({ config: defaultConfig(), source: "jev" as const, requestHash: input.requestHash }));
  return { decide, handler: createJudgeHandler({ decide }) };
}
it("allows an explicitly enabled loopback showcase more than ten calls, with a finite ceiling", async () => {
  localEnvironment();
  const { decide, handler } = fixture();
  for (let i = 0; i < 120; i++) expect((await (await handler(request())).json()).source).toBe("jev");
  expect((await (await handler(request())).json()).source).toBe("fallback");
  expect(decide).toHaveBeenCalledTimes(120);
});
it.each([undefined, "0", "true"])("retains default limits without exact opt-in: %s", async flag => {
  localEnvironment(); vi.stubEnv("LIFEPOT_SHOWCASE_MODE", flag);
  const { decide, handler } = fixture();
  for (let i = 0; i < 61; i++) await handler(request());
  expect(decide).toHaveBeenCalledTimes(60);
});
it.each(["example.com", "localhost.example.com", "192.168.1.2"])("does not expand quotas for non-loopback host %s", async host => {
  localEnvironment(); const { decide, handler } = fixture();
  for (let i = 0; i < 61; i++) await handler(request(host));
  expect(decide).toHaveBeenCalledTimes(60);
});
it.each(["1", "0", ""])("does not enable showcase on any Vercel-marked process: %s", async vercel => {
  localEnvironment(); vi.stubEnv("VERCEL", vercel);
  const { decide, handler } = fixture();
  for (let i = 0; i < 61; i++) await handler(request());
  expect(decide).toHaveBeenCalledTimes(60);
});
it.each(["127.0.0.1", "[::1]"])("supports explicit loopback addresses: %s", async host => {
  localEnvironment(); const { decide, handler } = fixture();
  for (let i = 0; i < 11; i++) await handler(request(host));
  expect(decide).toHaveBeenCalledTimes(11);
});
it.each([undefined, "staging"])("does not expand quotas in an unspecified runtime: %s", async runtime => {
  localEnvironment(); vi.stubEnv("NODE_ENV", runtime);
  const { decide, handler } = fixture();
  for (let i = 0; i < 61; i++) await handler(request());
  expect(decide).toHaveBeenCalledTimes(60);
});
it("allows a production model request only after the Cloudflare limiter allows it", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const decide = vi.fn(async () => ({ config: defaultConfig(), source: "jev" as const, requestHash: input.requestHash }));
  const rateLimit = vi.fn(async () => true);
  const globalRateLimit = vi.fn(async () => true);
  const handler = createJudgeHandler({ decide, rateLimit, globalRateLimit });
  const res = await handler(new Request("https://example.com/api/judge", { method: "POST", headers: { "cf-connecting-ip": "198.51.100.7" }, body: JSON.stringify(input) }));
  expect((await res.json()).source).toBe("jev");
  expect(rateLimit).toHaveBeenCalledWith("judge:198.51.100.7");
  expect(decide).toHaveBeenCalledOnce();
});

it("uses the deterministic fallback and skips model calls when Cloudflare denies production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const decide = vi.fn(async () => ({ config: defaultConfig(), source: "jev" as const, requestHash: input.requestHash }));
  const rateLimit = vi.fn(async () => false);
  const handler = createJudgeHandler({ decide, rateLimit });
  const res = await handler(new Request("https://example.com/api/judge", { method: "POST", body: JSON.stringify(input) }));
  expect((await res.json()).source).toBe("fallback");
  expect(decide).not.toHaveBeenCalled();
});

it("fails closed when the aggregate limiter is missing", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const decide = vi.fn(async () => ({ config: defaultConfig(), source: "jev" as const, requestHash: input.requestHash }));
  const rateLimit = vi.fn(async () => true);
  const handler = createJudgeHandler({ decide, rateLimit });
  expect((await (await handler(request())).json()).source).toBe("fallback");
  expect(rateLimit).not.toHaveBeenCalled(); expect(decide).not.toHaveBeenCalled();
});
