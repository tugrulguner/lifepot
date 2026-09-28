# Simulation contract

LifePot is a bounded artificial-life simulation. This document states what a run means and what it does not mean.

## Deterministic inputs

A run is determined by:

- the engine version;
- canonical setup answers and their request hash;
- the validated `LifeConfig` and world-rule graph;
- the unsigned 32-bit seed;
- the ordered, validated evolution-decision ledger.

Given accepted values for those inputs, the engine performs no inference during replay.

## World boundary

The engine contains a toroidal 50 × 50 grid and runs for at most 180 generations. State includes resources, hazards, occupancy, energy, age, organism generation, lineage, species, strategy, five bounded traits, ecological history, and aggregate statistics.

Only declared values exist:

- roles: producer, grazer, hunter, scavenger, omnivore;
- self-interactions: cooperative, territorial, cannibalistic, neutral;
- pair interactions: directional consumption, competition, mutualism, avoidance, neutral;
- regeneration, pressure, volatility, intensity, duration, activation, and transition enums defined in `src/game/rules.ts`;
- prey and predator strategies, mutation targets, mutation tempos, and decision triggers defined in `src/game/decisions.ts`.

User prose is mapped into this vocabulary. Unsupported concepts do not silently become new mechanics.

## Model authority

Jev may propose typed setup choices and typed ecological decisions. It cannot:

- execute code;
- introduce a new schema value;
- mutate arrays or world state directly;
- bypass graph validation;
- choose an activation outside the finite contract;
- apply a decision to a different observation, generation, trigger, or graph version;
- make replay call a model.

The engine—not the model—owns movement, feeding, resource growth, hazards, reproduction, mutation, death, rule activation, and outcomes.

## Guarantees

LifePot guarantees only the following within a fixed engine version:

- accepted replay inputs are contract-valid;
- canonical graph pairs are complete and ordered;
- a graph has a viable basal-energy path;
- accepted probability maps cover all options, sum approximately to one, and select a maximum-probability choice;
- decision ledger order and cooldown are valid;
- each accepted runtime decision matches its frozen observation;
- replay rejects missing, extra, reordered, unreachable, or tampered decisions;
- fallback output is labeled.

## Non-guarantees

LifePot does not claim:

- biological realism or predictive accuracy;
- that a species name or model explanation introduces a mechanic;
- that model confidence proves ecological correctness;
- that a mutation target makes mutations beneficial;
- that adaptation has intent or foresight;
- that every described organism or chemical has a literal representation;
- that survival is preferred over extinction;
- that an inference provider will be available.

## Outcomes

A run can be `extinct`, `surviving`, or `thriving`. Extinction is a valid result. The engine does not resurrect populations to satisfy a narrative.

Any change to deterministic behavior requires an engine-version change and replay-compatibility review.
