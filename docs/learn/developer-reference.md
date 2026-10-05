# Developer reference: contracts, deterministic execution, and operations

This guide describes the implementation in this repository, not a supported external SDK. LifePot's supported interface is the web game. `/api/judge` is an internal application endpoint; its request shapes are implementation contracts, not a public service promise.

## Quick local verification

With Node/npm installed, run the real project checks:

```sh
npm ci
npm test
npm run typecheck
npm run lint
```

A deterministic setup example can run without inference or credentials. From the repository root, use `npx tsx` only if your environment already provides it; it is not a project dependency or promised interface. The project tests exercise the public-to-the-app TypeScript functions directly and are the copyable, dependency-safe contract examples:

```sh
npm test -- src/game/setup.test.ts src/game/rules.test.ts src/game/replay.test.ts
```

For deployment build requirements, see [Deployment](../deployment.md). Do not send arbitrary requests to production `/api/judge`: it is an internal, quota-protected application route.

## Setup schemas and normalization

Source of truth: `src/game/setup.ts`, `src/game/world.ts`.

`setupAnswersSchema` is a strict object with exactly `world`, `threat`, and `reward`; each is a trimmed, nonempty string of at most 140 characters. Unknown keys fail. `canonicalAnswers` trims and revalidates. `hashSetupRequest` hashes the canonical ordered answer tuple and prefixes it with `setup_`.

`LifeConfig` is strict at each schema level:

| Field | Accepted values / constraint |
| --- | --- |
| `environment.abundance` | `scarce`, `balanced`, `rich` |
| `environment.distribution` | `clustered`, `scattered`, `seasonal` |
| `environment.hazard` | `drought`, `toxin`, `heat`, `crowding` |
| `environment.volatility` | `stable`, `pulsing`, `chaotic` |
| `fitness` | exactly `survive`, `replicate`, `cooperate`, `explore`, `adapt`; each 0–1 and total within 1e-9 of 1 |
| `founders.balance` | `prey_heavy`, `balanced`, `predator_heavy` |
| `founders.diversity` | `focused`, `varied` |
| `founders.preyStrategy` | `efficient_grazing`, `early_brood`, `armored`, `swarming`, `dispersal` |
| `founders.predatorStrategy` | `ambush`, `pursuit`, `pack_hunting`, `efficient_kill`, `brood_hunting` |
| `rules` | optional `WorldRuleGraph`; if omitted the default graph is used by the engine |

`normalizeFitness` clamps negative/non-finite inputs to zero and normalizes; an all-zero input becomes equal weights. It is not a substitute for validating external config. `defaultConfig()` uses balanced/scattered/drought/stable, equal weights, balanced/varied founders, efficient grazing/pursuit, and `defaultRuleGraph()`.

Setup prose maps by fixed keyword rules in `deterministicSetup`; it does not generate executable logic. The route may request typed setup interpretation from Jev, validates the response, and returns deterministic setup as an explicitly labeled fallback when model access or validation fails.

## Rule graph reference

Source: `src/game/rules.ts`; tests: `src/game/rules.test.ts`.

A graph has integer `version >= 1`, 2–4 species in canonical prefix order (`A`, `B`, `C`, `D`), one interaction for every canonical species pair exactly once and in order, an environment object, and optional validated council metadata. Species roles: `producer`, `grazer`, `hunter`, `scavenger`, `omnivore`. Self-interactions: `cooperative`, `territorial`, `cannibalistic`, `neutral`. Pair modes: `a_consumes_b`, `b_consumes_a`, `competition`, `mutualism`, `avoidance`, `neutral`.

The graph must have a viable basal-feeding role (`producer`, `grazer`, or `omnivore`). Roles alone do not authorize predation: directional pair edges control inter-species consumption. A strict invalid shape throws `Invalid ecosystem rule graph`; canonical-order, complete-pair, and basal-path invariant violations throw descriptive errors. Validation returns a cloned graph.

Environment vocabularies are regeneration (`steady`, `pulsed`, `depletion_feedback`), pressure (`stability`, `drought`, `toxin_wave`, `heat_wave`, `fragmentation`, `nutrient_bloom`), volatility (`stable`, `pulsing`, `chaotic`), intensity (`low`, `medium`, `high`), and duration (`short`, `medium`, `long`, `persistent`). Scheduled activations are `immediate`, `after_6`, `after_12`, `after_24`, `resources_low`, `population_boom`, `population_crash`, `species_emergence`, `species_extinction`, `predation_high`; transitions are `abrupt`, `ramp`, `pulse`.

A `RulePatch` is exactly one of: `{kind:"pair", pair, mode}`, `{kind:"self", species, value}`, or `{kind:"environment", field, value}`. It is strict; unknown keys/enum values reject. Pair and species targets must exist. A changed patch increments graph version once; an unchanged patch does not. Scheduled changes bind a generation 0–180, activation, duration, transition, and patch. They only take effect when their trigger is due and the accepted decision's graph-version evidence is valid. Temporary changes revert according to duration; persistent changes do not automatically revert.

### Validation example (actual functions)

Run the focused tests above to execute these cases using the repository's installed Vitest. This valid default graph is the actual `defaultRuleGraph()` contract; the second input is deliberately invalid because it adds an undeclared graph property and strict validation rejects it.

```ts
import { defaultRuleGraph, validateRuleGraph } from "./src/game/rules";

const graph = validateRuleGraph(defaultRuleGraph());
console.log(graph.species.length, graph.interactions[0].mode); // 2, "b_consumes_a"
try {
  validateRuleGraph({ ...graph, surprise: true });
} catch (error) {
  console.log((error as Error).message); // "Invalid ecosystem rule graph"
}
```

This snippet assumes the project TypeScript/Vitest environment and repository-root import path. It is a source-level example, not a standalone JavaScript script.

## Engine ownership and deterministic loop

Source: `src/game/world.ts`, `src/game/decisions.ts`, `src/game/runtime.ts`.

`createSimulation({seed, config, initialPopulation?, initialResources?})` clones and validates the rule graph. The default world is a 50×50 torus (2,500 cells), uses an unsigned 32-bit seed, has five byte-range traits per organism, energy capped at 255, and runs at most 180 generations. Initial resources and organisms can be injected for deterministic tests. `ENGINE_VERSION` is currently `lifepot-ca-7`; verify the source when updating this document.

The simulation's seeded PRNG drives resource initialization, placement, movement and reproduction choices, and mutation. Each generation calculates resource growth/hazards and organism actions from the previous state, then derives new aggregates/history and outcome. Organisms feed on basal resources only when their rule role allows it. Predation requires a directional graph relation (or an allowed cannibalistic self-relation); population counts do not create food-web edges. Reproduction transfers 38% of parental energy to the child, rather than creating energy. Mutation is bounded, may fail at trait bounds, and may change species identity; strategy and traits remain finite.

The engine owns movement, feeding, resource growth, hazards, reproduction, mutation, death, scheduled rule activation, and outcome. `fitness` influences mechanics; it does not specify a guaranteed result. The final `extinct` outcome is zero population; after the generation limit, a surviving world is `thriving` only when prey count is at least 50 and predators remain, otherwise `surviving`.

## Bounded decisions, frozen observations, and ledger

Decision schemas and allowed triggers/strategies live in `src/game/decisions.ts`. `src/game/runtime.ts` advances deterministically until a trigger, freezes and hashes the observation, and binds the accepted decision to that exact observation, generation, trigger and graph version. A decision must cover the declared probability choices, have valid probabilities and select a maximum-probability option. Species directives are checked against configured species. The model cannot send state mutations, arbitrary code, or undeclared enum values.

A trigger cannot occur before generation 12, within 12 generations of the previous accepted decision, or after eight ledger entries. Accepted entries remain ordered. Missing/invalid model output takes the labeled deterministic fallback path; no invalid proposal is treated as an accepted model decision. Cooldown, trigger, observation, generation, and graph-version checks are enforced in the runtime, not trusted from prose.

## Replay and tamper/version compatibility

Source: `src/game/replay.ts`; tests: `src/game/replay.test.ts`.

Replay v3 is a strict object containing `version: 3`, current `engineVersion`, canonical answers, validated config, integer seed 0–4,294,967,295, `setup_…` request hash, ledger of at most eight entries, and a `replay_…` contract hash. `createReplay` canonicalizes and validates; `encodeReplay` serializes validated replay data; `decodeReplay` validates the decoded object; `playReplay` runs the recorded ledger through the deterministic engine and returns replay/state/snapshot without inference. The optional interpreter parameter is intentionally unused.

Any malformed, tampered, unsupported, or semantically unreachable input is rejected (`Invalid, tampered, or unsupported LifePot replay v3` or `Invalid or unsupported LifePot replay`). The contract hash is a compact FNV-1a integrity checksum, not a cryptographic signature or proof against a determined attacker. A future engine behavior change requires an engine version change and compatibility review; do not claim cross-version support unless explicitly implemented and tested.

## HTTP and deployment boundaries

The `/api/judge` route is server-only for interpretation, not a public API. It checks strict payload schemas, limits request bodies to 16 KiB, applies `Cache-Control: no-store`, and uses the Cloudflare `JUDGE_RATE_LIMIT` binding for production call protection. Binding denial, absence, or errors fail closed to deterministic fallback rather than an unmetered model request. The Workers limiter is per client key and Cloudflare location, eventually consistent—not a global billing quota. Provider-side limits remain the spend control.

`TYPESAFE_API_KEY` is optional, server-only, and must never be exposed under `NEXT_PUBLIC_` or bundled to the browser. Do not add provider keys to docs/examples. Local development and tests inject deterministic in-process limiting; that local behavior is not production protection. See [deployment guide](../deployment.md) and [architecture](../architecture.md).

## Source map

- Setup vocabulary and hashes: `src/game/setup.ts`, `src/game/setup.test.ts`
- Rule schemas and patches: `src/game/rules.ts`, `src/game/rules.test.ts`
- Mechanics and world state: `src/game/world.ts`, `src/game/mechanics.test.ts`, `src/game/world.test.ts`
- Decisions, triggers and ledger: `src/game/decisions.ts`, `src/game/runtime.ts`, `src/game/decision-continuity.test.ts`
- Replay: `src/game/replay.ts`, `src/game/replay.test.ts`
- Server schemas, fallback, quota: `src/app/api/judge/`
- Interface: `src/components/GameCanvas.tsx`, `WorldObservatory.tsx`, `CreatureInspector.tsx`
- [Player guide](/learn/player-guide) · [Architecture](../architecture.md) · [Simulation contract](../simulation-contract.md) · [Deployment](../deployment.md)
