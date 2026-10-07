# Deployment

LifePot is a Next.js application with a server-only `/api/judge` route.

## Environment

| Variable | Local | Production | Purpose |
| --- | --- | --- | --- |
| `TYPESAFE_API_KEY` | Optional | Optional | Enables live Jev interpretation; absence uses deterministic fallback |

`TYPESAFE_API_KEY` is server-only. Never expose it through a `NEXT_PUBLIC_` variable or browser bundle. Production abuse protection is configured as the `JUDGE_RATE_LIMIT` Workers Rate Limiting binding in `wrangler.jsonc`; it is not an environment secret.

## Local run

```bash
npm ci
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1
```

Binding to loopback avoids exposing an unprotected development server to the local network.

## Production behavior

The route enforces:

- a 16 KiB request-body limit;
- strict setup and evolution request schemas;
- `Cache-Control: no-store`;
- a Cloudflare Workers Rate Limiting binding configured for 60 downstream provider calls per minute per client key and Cloudflare location;
- a separate aggregate binding configured for 240 provider calls per minute per Cloudflare location;
- fail-closed deterministic fallback when the binding is absent, denies a call, or errors.

A corrected setup can consume seven provider calls. Each adaptive council checkpoint uses two, and a run records at most eight checkpoints. Setup, a complete adaptive run and reflection fit within 24 calls; two workflows fit within 48. The shared 60-call client window supports rapid experiments without test-only cooldowns, while still limiting every real provider call. These are LifePot abuse controls, not evidence of a Jev service quota. The higher aggregate limit permits more inference volume but remains bounded.

Cloudflare's binding is location-local and eventually consistent, so it is an abuse-control measure, not an exact global quota or billing ledger. Provider-side usage limits remain the spend backstop. Local Node development and unit tests use an injected, deterministic in-process limiter; production must not fall back to an unmetered model call.

## Verification before deployment

```bash
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Also verify:

- the Cloudflare `JUDGE_RATE_LIMIT` binding is present in the production Worker;
- `/api/judge` responses are not cached by a proxy;
- the deployment preserves the client IP header expected by the hosting path;
- a Cloudflare rate-limit fallback remains visible in the interface;
- provider-side usage limits are configured as the spend backstop;
- a replay completes with downstream model access disabled.

## Operational notes

The local in-process limiter is a deterministic development/test fallback and resets with the server process. Cloudflare Workers Rate Limiting is per-location and eventually consistent; it is not an exact spend counter. Enforce provider-side usage limits and monitor provider usage independently.
