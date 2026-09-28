# Architecture

LifePot separates model interpretation from deterministic simulation. The boundary is deliberate: Jev may choose among declared options, but only application code mutates the world.

![LifePot execution architecture](assets/lifepot-architecture.png)

The editable source is [`assets/lifepot-architecture.svg`](assets/lifepot-architecture.svg).

## Request path

1. The browser collects `world`, `threat`, and `reward` answers.
2. `src/game/setup.ts` canonicalizes them and derives the setup request hash.
3. `src/app/api/judge/route.ts` validates request size, shape, and quota before dispatch.
4. `src/app/api/judge/service.ts` asks Jev typed questions or returns a labeled deterministic fallback.
5. `src/game/rules.ts` validates the complete world-rule graph and its invariants.
6. `src/game/world.ts` creates and advances the seeded cellular world.

No response field is evaluated as source code.

## Runtime ownership

| Area | Owner | Responsibility |
| --- | --- | --- |
| Setup contract | `src/game/setup.ts` | Canonical answers, request/replay hashes, setup schemas, deterministic fallback |
| Rule graph | `src/game/rules.ts` | Finite vocabularies, graph invariants, rule patches, activation conditions |
| Model boundary | `src/app/api/judge/` | HTTP schemas, TypeSafe client calls, fallback selection, quota enforcement |
| Ecological decisions | `src/game/decisions.ts` | Frozen observations, triggers, evidence schemas, deterministic decisions |
| Runtime orchestration | `src/game/runtime.ts` | Trigger pauses, exact-decision binding, ledger ordering and cooldown |
| Simulation | `src/game/world.ts` | Cellular mechanics, deterministic random stream, graph execution, outcomes |
| Replay | `src/game/replay.ts` | Contract validation, encoding, tamper detection, inference-free playback |
| Interface | `src/components/GameCanvas.tsx` | Setup, world review, controls, visualization, and replay interaction |

## World-rule graph

A graph contains:

- two to four canonical species slots (`A` through `D`);
- one trophic role and one self-interaction per species;
- every canonical pair exactly once;
- one environment rule set;
- a monotonically increasing graph version.

Validation also requires a viable basal-energy path. Scheduled patches can change one pair relationship, one species self-interaction, or one environment field. A patch is applied only when its bound trigger condition is due and its graph-version evidence matches.

## Decision loop

`detectEvolutionTrigger` observes the deterministic world. It cannot trigger before generation 12, within 12 generations of the previous accepted decision, or after eight ledger entries.

At a trigger:

1. LifePot freezes and hashes the observation.
2. Jev or the deterministic fallback proposes a typed decision.
3. Validation checks probability coverage, selected maxima, trigger, generation, observation hash, graph version, and scheduled-change evidence.
4. The accepted decision is appended to the ordered ledger.
5. Deterministic stepping resumes and applies only the bounded mechanics encoded by the decision.

## Replay

Replay version 3 binds:

- the engine version;
- canonical setup answers;
- validated configuration;
- unsigned 32-bit seed;
- canonical setup hash;
- ordered evolution ledger;
- replay contract hash.

Validation runs the ledger through the engine. Missing, reordered, unreachable, mismatched, or modified decisions fail before a replay is accepted.

## Failure behavior

- Missing API key: deterministic fallback.
- Invalid model response: deterministic fallback.
- Network or timeout failure: deterministic fallback.
- Invalid request: rejected before interpretation.
- Production without distributed quota configuration: fails closed to fallback.
- Invalid replay: rejected; no best-effort execution.

Fallback output is always marked with `source: "fallback"` and is never presented as Jev evidence.
