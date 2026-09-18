# LifePot

LifePot is a deterministic 50×50 artificial-life simulation. Three short visitor answers define resource conditions, threats, environmental volatility, and fitness priorities. Code then runs a cellular population for up to 180 generations and reports extinction, survival, or thriving with population, birth, death, generation, and lineage statistics.

## Core model

- Organisms occupy cells and carry energy, age, generation, lineage, and five bounded heritable traits.
- Organisms consume regrowing resources, pay metabolism and hazard costs, die, reproduce into adjacent empty cells, and mutate deterministically.
- The grid is toroidal and stored in typed arrays.
- Environment settings are finite and mechanical: resource abundance, distribution, volatility, and drought, toxin, heat, crowding, or moving-predator hazards. Unsupported prose is mapped to the closest disclosed archetype rather than becoming executable rules.
- Fitness is a normalized vector across survival, replication, cooperation, exploration, and adaptation. Every component changes engine mechanics.
- The seed, configuration, engine version, and recorded decision ledger fully determine the run.

## Setup interpretation

`POST /api/judge` accepts exactly three strings of at most 140 characters:

1. What exists in this world?
2. What threatens life here or how does it change?
3. What should life be rewarded for?

The server asks four independent TypeSafe Choice questions and five independent Score questions in one Jev request, validates the complete response, and normalizes the fitness vector. A deterministic semantic fallback is used if Jev is unavailable or returns invalid data. Visitor text remains data; it never becomes executable rules.

Local development needs only `TYPESAFE_API_KEY` for live Jev calls. Every setup submission calls Jev, including repeated answers, so the showcase exposes real model behavior and token usage rather than replaying a cached interpretation. Production additionally requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; Upstash is used only for distributed abuse limits and the daily spend cap. Without it, production fails closed to the deterministic interpreter.

## Runtime decision epochs

A fresh simulation pauses before any cell step at generations 0, 30, 60, 90, 120, and 150. At each epoch, LifePot summarizes the numeric world state and five fixed cell cohorts, then sends one `{ kind: "epoch", summary }` request to `/api/judge`. Jev chooses one bounded environment action and one bounded action for every cohort; those policies remain active for every generation until the next epoch. The UI shows when Jev is deciding, the active source and model, the environment and cohort actions, and cumulative epoch token usage.

Epoch responses are runtime-validated before use. Network failures, invalid responses, unavailable credentials, and rate/spend limits produce a visibly labeled deterministic fallback decision so the simulation can continue. Responses are not cached. The 3× control still stops exactly at undecided epochs rather than stepping past them.

## Replay

Replay data contains the exact answers, interpreted configuration, seed, engine version, canonical request hash, the ordered epoch decision ledger, and a contract hash. Replay validates all fields, rejects noncanonical or modified payloads, and applies the recorded ledger without calling Jev. If a population becomes extinct before a later epoch, only the decisions reachable before extinction are required. Restarting a replay starts a fresh run and makes new live epoch requests.

## Local development

```bash
npm install
cp .env.example .env.local # optional
npm run dev
```

## Quality gates

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Stack

Next.js 16, React 19, TypeScript, typed arrays, Zod, TypeSafe AI SDK, Upstash, and Vitest.
