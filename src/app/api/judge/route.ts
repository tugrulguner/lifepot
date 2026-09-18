import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { deterministicSetup, hashSetupRequest } from "@/game/setup";
import { setupRequestSchema, type SetupRequest } from "./schema";
import { interpretSetup, type SetupInterpretation } from "./service";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 16_384; const MAX_IP_BUCKETS = 1024;
const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = configured ? Redis.fromEnv() : null;
const ipLimiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "lifepot:setup:ip" }) : null;
const spendLimiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(500, "1 d"), prefix: "lifepot:setup:daily" }) : null;
type HandlerOptions = { decide?: (input: SetupRequest) => Promise<SetupInterpretation>; maxRequests?: number; windowMs?: number; now?: () => number };
type Bucket = { count: number; resetAt: number };
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function clientIp(request: Request) { const raw = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; return /^[0-9a-fA-F:.]{1,45}$/.test(raw) ? raw : "unknown"; }
function fallback(input: SetupRequest): SetupInterpretation { return { config: deterministicSetup(input.answers), source: "fallback", requestHash: hashSetupRequest(input.answers) }; }

export function createJudgeHandler(options: HandlerOptions = {}) {
  const decide = options.decide ?? interpretSetup; const maxRequests = options.maxRequests ?? 20; const windowMs = options.windowMs ?? 60_000; const now = options.now ?? Date.now;
  const rates = new Map<string, Bucket>();
  function limited(ip: string) { const time = now(); let bucket = rates.get(ip); if (!bucket || time >= bucket.resetAt) { if (!bucket && rates.size >= MAX_IP_BUCKETS) rates.delete(rates.keys().next().value as string); bucket = { count: 0, resetAt: time + windowMs }; rates.set(ip, bucket); } bucket.count += 1; return bucket.count > maxRequests; }
  return async (request: Request) => {
    const ip = clientIp(request); if (limited(ip)) return response({ error: "Too many requests" }, 429);
    try {
      const declared = Number(request.headers.get("content-length") ?? 0); if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return response({ error: "Setup is too large" }, 413);
      const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return response({ error: "Setup is too large" }, 413);
      const parsed = setupRequestSchema.safeParse(JSON.parse(raw)); if (!parsed.success) return response({ error: "Invalid setup" }, 400);
      const trustedHash = hashSetupRequest(parsed.data.answers); if (parsed.data.requestHash !== trustedHash) return response({ error: "Setup hash mismatch" }, 400);
      if (!options.decide) {
        if (!process.env.TYPESAFE_API_KEY) return response(fallback(parsed.data));
        if (process.env.NODE_ENV === "production") {
          try {
            if (!redis || !ipLimiter || !spendLimiter) return response(fallback(parsed.data));
            const [perIp, daily] = await Promise.all([ipLimiter.limit(ip), spendLimiter.limit("global")]); if (!perIp.success || !daily.success) return response(fallback(parsed.data));
          } catch {
            return response(fallback(parsed.data));
          }
        }
      }
      try {
        return response(await decide(parsed.data));
      } catch {
        return response(fallback(parsed.data));
      }
    } catch { return response({ error: "Invalid setup" }, 400); }
  };
}
export const POST = createJudgeHandler();
