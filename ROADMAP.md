# LifePot roadmap

This roadmap describes direction, not shipped behavior. The README's “What ships today” section is the current product contract.

## Now — make every run inspectable

- Make rule-graph state and accepted changes easy to inspect during a run.
- Preserve exact decision provenance and fallback labeling in the interface.
- Expand acceptance coverage across desktop, narrow, and reduced-motion layouts.
- Keep replay rejection strict as the simulation contract evolves.

## Next — deepen bounded ecology

- Add ecology mechanics only when they can be expressed as finite, reviewable rules.
- Improve organism and lineage inspection without inferring events that were not recorded.
- Measure complete-run performance before changing storage or execution architecture.
- Add curated world examples that demonstrate distinct mechanics and remain replayable.

## Later — share and compare experiments

- Export auditable run summaries alongside replay data.
- Compare runs by seed, rule graph, and accepted decision ledger.
- Publish a stable deployment after quota, privacy, and operational checks are automated.
- Integrate LifePot into the ModePot family site when its public surface is stable.

## Standing constraints

- Deterministic code owns simulation mechanics.
- Model output stays typed, bounded, validated, and auditable.
- Replay compatibility is explicit and engine-versioned.
- Extinction remains a valid outcome.
- No roadmap item may be documented as shipped before implementation and verification.

Propose scoped work through [GitHub Issues](https://github.com/tugrulguner/lifepot/issues). Discuss contract changes before implementation.
