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

Setup uses six provider calls on the direct path (environment/fitness, named organism mapping, named roles, directed pairs, council, and fidelity review). One bounded duplicate-identity correction adds at most one mapping call; the later food-web correction adds at most four. An otherwise valid council response whose selected label contradicts its probability maximum receives at most one reserved corrective request per council selection; malformed distributions and metadata do not qualify. Both initial and repaired council selection can need this attempt. The complete setup is bounded at thirteen calls. Each adaptive council checkpoint normally uses at most two calls. One shared validation-directed correction allowance covers orchestrator and specialist stages, so a repaired checkpoint uses at most three. A run records at most eight checkpoints. A worst-case setup, repaired adaptive run and reflection use at most 38 calls; two repair-heavy workflows can require 76 and therefore exceed the existing 60-call client window. The limit remains 60: a denied reservation makes no SDK request and safely abstains. Every rejected attempt with valid metadata is included in accepted decision usage and correction provenance. Invalid token metadata, transport failures and final internal reconciliation errors are not retried. Persistent invalid output is rejected after the one shared correction. No probabilities, selected choices or scopes are rewritten. The original production failure cause remains unidentified; bounded recovery is verified against reproduced protocol-failure classes. The shared 60-call client window supports rapid experiments without test-only cooldowns, while still limiting every real provider call. These are LifePot abuse controls, not evidence of a Jev service quota. The aggregate limit remains bounded.

The setup contract establishes 2–4 model-selected organism identities from mechanically enumerated source-word spans, then selects roles and directed relationships for those named organisms. Initial setup no longer independently chooses a competing species count, roles or feeding graph. Correction receives that same contract, and deterministic comparison blocks a corrected graph that loses a species, changes its role or reverses a feeding direction, even if fidelity review says approve. Ambiguity and unsupported requests remain model-reviewed; the contract is not a keyword-based acceptance rule or a guarantee of correct interpretation for every description.

Setup failures carry only a finite stage and classified code through the browser transport. No raw provider payload, exception text or credential is exposed. Failed correction remains unseedable and preserves the original answers. The historical production `invalid_response` cause remains unclassified until a failure is observed with this metadata.

Cloudflare's binding is location-local and eventually consistent, so it is an abuse-control measure, not an exact global quota or billing ledger. Provider-side usage limits remain the spend backstop. Local Node development and unit tests use an injected, deterministic in-process limiter; production must not fall back to an unmetered model call.

## Reflection failure diagnosis

`/api/reflect` retains HTTP 503 for unavailable or rejected reflection and never manufactures a recommendation. Server diagnostics distinguish limiter failures from reflection failures. Reflection failures additionally carry a finite boundary: configuration, reservation, provider, wire, probabilities, or result. `provider` means the SDK call failed; it does not by itself distinguish upstream availability from SDK-side validation. `wire` is this application's response-schema check; `probabilities` checks exact options, normalization, and maximal selection; `result` validates the grounded reflection.

Only the boundary and an allowlisted error class are retained and logged. Provider errors, messages, response bodies, headers, private predictions, and credentials are neither attached to classified failures nor transported to the browser. This adds no inference attempts, retries, or quota changes. A classified boundary is evidence of where processing failed, not proof of its root cause; the historical reflection 503 remains unexplained.

## Public page and walkthrough delivery

`npm run build:cloudflare` builds Next/OpenNext, then prepares the delivery Worker used by Wrangler. Only immutable prerendered public HTML, client-navigation payloads, segments and downloads are copied to build-versioned assets. The homepage reads legacy replay links in the browser rather than making every visitor trigger server rendering. API, mutating and unmatched requests retain the original Next handler and inference protections.

The fixed walkthrough endpoint runs ahead of Next and streams the requested range with bounded chunk memory; HEAD, matching conditional requests and invalid ranges do not read the video. It never forwards visitor cookies, authorization or replay data to the asset binding. Unknown-length asset streams are supported; a premature end fails the response stream rather than returning fabricated video bytes.

After building, `npm run test:cloudflare` launches an isolated keyless local Worker, verifies the exact prepared homepage and runs delivery plus native-video acceptance without retries. Use `npm run test:cloudflare -- --all` for the complete browser suite. The runner stops its own Worker on completion. CI runs the focused Worker checks as well as the existing development-server browser suite. These local checks do not establish production CPU consumption; deployed revision and resource outcomes must still be verified after an approved rollout.

The default walkthrough is a 2,125,192-byte, 1920×1080 H.264 export at 15 fps, retaining the full 168-second timeline, chapters, poster and captions. It was recompressed from the original 5,202,349-byte video with the shared ModePot video kit using CRF 28 and the slow preset. The new content-addressed URL ends in `8e6e10b2.mp4`; the original `537cbbf6.mp4` URL keeps its original bytes and ETag for existing links and immutable caches. This reduces transferred bytes by 59.15%; production CPU savings must be measured after deployment rather than inferred from file size alone.

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
