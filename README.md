# LifePot

LifePot is a deterministic 50×50 artificial-life simulation. Three short visitor answers define resource conditions, threats, environmental volatility, and fitness priorities. Code then runs a cellular population for up to 180 generations and reports extinction, survival, or thriving with population, birth, death, generation, and lineage statistics.

## Core model

- Organisms occupy cells and carry energy, age, generation, lineage, and five bounded heritable traits.
- Organisms consume regrowing resources, pay metabolism and hazard costs, die, reproduce into adjacent empty cells, and mutate deterministically.
- The grid is toroidal and stored in typed arrays.
- Environment settings are finite and mechanical: resource abundance, distribution, volatility, and drought, toxin, heat, crowding, or moving-predator hazards. Unsupported prose is mapped to the closest disclosed archetype rather than becoming executable rules.
- Fitness is a normalized vector across survival, replication, cooperation, exploration, and adaptation. Every component changes engine mechanics.
- The seed, configuration, and engine version fully determine the run.

## Setup interpretation

`POST /api/judge` accepts exactly three strings of at most 140 characters:

1. What exists in this world?
2. What threatens life here or how does it change?
3. What should life be rewarded for?

The server asks four independent TypeSafe Choice questions and five independent Score questions in one Jev request, validates the complete response, and normalizes the fitness vector. A deterministic semantic fallback is used if Jev is unavailable or returns invalid data. Visitor text remains data; it never becomes executable rules.

Local development needs only `TYPESAFE_API_KEY` for live Jev calls. Every setup submission calls Jev, including repeated answers, so the showcase exposes real model behavior and token usage rather than replaying a cached interpretation. Production additionally requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; Upstash is used only for distributed abuse limits and the daily spend cap. Without it, production fails closed to the deterministic interpreter.

## Replay

Replay data contains the exact answers, interpreted configuration, seed, engine version, canonical request hash, and a contract hash. Replay validates all fields, rejects noncanonical or modified payloads, and runs without calling Jev.

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
