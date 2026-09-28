import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { deterministicSetup, hashSetupRequest } from "@/game/setup";
import { deterministicEpochDecision, type EpochDecision } from "@/game/decisions";
import { epochRequestSchema, setupRequestSchema, type EpochRequest, type SetupRequest } from "./schema";
import { decideEpoch, interpretSetup, type SetupInterpretation } from "./service";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 16_384; const MAX_IP_BUCKETS = 1024;
const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = configured ? Redis.fromEnv() : null;
const ipLimiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "lifepot:judge:ip" }) : null;
const spendLimiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(500, "1 d"), prefix: "lifepot:judge:daily" }) : null;
type HandlerOptions = {
  decide?: (input: SetupRequest) => Promise<SetupInterpretation>;
  epochDecide?: (input: EpochRequest) => Promise<EpochDecision>;
  maxRequests?: number; windowMs?: number; now?: () => number;
};
type Bucket = { count: number; resetAt: number };
type JudgeRequest = SetupRequest | EpochRequest;
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function clientIp(request: Request) { const raw = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; return /^[0-9a-fA-F:.]{1,45}$/.test(raw) ? raw : "unknown"; }
function setupFallback(input: SetupRequest): SetupInterpretation { return { config: deterministicSetup(input.answers), source: "fallback", requestHash: hashSetupRequest(input.answers) }; }
function fallback(input: JudgeRequest): SetupInterpretation | EpochDecision { return "kind" in input ? deterministicEpochDecision(input.summary) : setupFallback(input); }

export function createJudgeHandler(options: HandlerOptions = {}) {
  const setupDecide = options.decide ?? interpretSetup; const epochDecide = options.epochDecide ?? decideEpoch;
  const maxRequests = options.maxRequests ?? 10; const windowMs = options.windowMs ?? 60_000; const now = options.now ?? Date.now;
  const rates = new Map<string, Bucket>();
  function limited(ip: string) { const time = now(); let bucket = rates.get(ip); if (!bucket || time >= bucket.resetAt) { if (!bucket && rates.size >= MAX_IP_BUCKETS) rates.delete(rates.keys().next().value as string); bucket = { count: 0, resetAt: time + windowMs }; rates.set(ip, bucket); } bucket.count += 1; return bucket.count > maxRequests; }
  return async (request: Request) => {
    const ip = clientIp(request);
    try {
      const declared = Number(request.headers.get("content-length") ?? 0); if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return response({ error: "Request is too large" }, 413);
      const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return response({ error: "Request is too large" }, 413);
      const json: unknown = JSON.parse(raw);
      const epochParsed = epochRequestSchema.safeParse(json);
      const setupParsed = epochParsed.success ? null : setupRequestSchema.safeParse(json);
      let input: JudgeRequest;
      if (epochParsed.success) input = epochParsed.data;
      else if (setupParsed?.success) input = setupParsed.data;
      else return response({ error: "Invalid judge request" }, 400);
      if (!("kind" in input)) {
        const trustedHash = hashSetupRequest(input.answers); if (input.requestHash !== trustedHash) return response({ error: "Setup hash mismatch" }, 400);
      }
      if (limited(ip)) return response(fallback(input));
      const injected = "kind" in input ? options.epochDecide : options.decide;
      if (!injected) {
        if (!process.env.TYPESAFE_API_KEY) return response(fallback(input));
        if (process.env.NODE_ENV === "production") {
          try {
            if (!redis || !ipLimiter || !spendLimiter) return response(fallback(input));
            const [perIp, daily] = await Promise.all([ipLimiter.limit(ip), spendLimiter.limit("global")]);
            if (!perIp.success || !daily.success) return response(fallback(input));
          } catch { return response(fallback(input)); }
        }
      }
      try {
        return response("kind" in input ? await epochDecide(input) : await setupDecide(input));
      } catch { return response(fallback(input)); }
    } catch { return response({ error: "Invalid judge request" }, 400); }
  };
}
export const POST = createJudgeHandler();
