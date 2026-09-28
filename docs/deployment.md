# Deployment

LifePot is a Next.js application with a server-only `/api/judge` route.

## Environment

| Variable | Local | Production | Purpose |
| --- | --- | --- | --- |
| `TYPESAFE_API_KEY` | Optional | Optional | Enables live Jev interpretation; absence uses deterministic fallback |
| `UPSTASH_REDIS_REST_URL` | Optional | Required for live model calls | Distributed per-IP and global daily limits |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Required for live model calls | Authenticates the Upstash client |

Never expose these values through a `NEXT_PUBLIC_` variable or browser bundle.

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
- an in-process per-client fallback limiter;
- a distributed limit of 10 requests per minute per client when Upstash is configured;
- a distributed global budget of 500 requests per day when Upstash is configured.

When production distributed quota configuration is absent or unavailable, the route fails closed to deterministic fallback rather than making an unmetered downstream model call.

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

- secrets exist only in the deployment secret store;
- both Upstash variables are set together;
- `/api/judge` responses are not cached by a proxy;
- the deployment preserves the client IP header expected by the hosting path;
- rate-limit fallback remains visible in the interface;
- a replay completes with downstream model access disabled.

## Operational notes

The in-process limiter resets when a server process restarts and is not a billing ledger. Distributed limits bound requests; they do not make provider usage free. Monitor provider and Upstash usage independently.
