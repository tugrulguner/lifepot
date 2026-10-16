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

## Player-experience roadmap — worlds worth returning to

This proposed track explores two reasons to play: low-pressure experimentation and an ongoing world whose changes are worth returning to discover. These are product hypotheses informed by adjacent games, not evidence of LifePot player demand or a commitment to implement every item. They supplement the technical priorities above; each slice needs its own scope and verification before implementation.

### 1. Make short experiments rewarding

- Keep the path from an idea to a visible, inspectable world short; support curiosity without forcing every player into a survival objective.
- Make meaningful changes legible during ordinary playback: population shifts, feeding, births, deaths, environmental pressure, and followed-family turning points.
- Explain the actual stop reason and observed outcome, then offer a reviewable next experiment with explicit changed conditions.
- Build on existing inspection, lineage following, replay, and comparison surfaces rather than adding duplicate panels or selling technical complexity as gameplay.

**Acceptance:** complete an ordinary setup-to-result journey on desktop and mobile, follow an organism or family through a recorded turning point, and start a changed-condition follow-up. Verify that the interface distinguishes observations, deterministic mechanisms, Jev interventions, and comparative evidence. Agent-led checks establish working affordances, not human enjoyment.

### 2. Investigate persistent personal worlds

The current contract stops at 180 generations. Replaying a completed run reproduces its history; saving that recording does not create a world that continues evolving. A longer-lived habitat would be a new simulation and persistence contract, not a wrapper or a generation-limit toggle.

- First assess whether a bounded longer-running habitat can remain interesting and performant within a small-project maintenance budget. Do not promise indefinite simulation or background evolution.
- Design explicit pause, save, reload, and resume semantics for a living world, preserving its complete deterministic state, random-number state, engine version, accepted decisions, and remaining decision budget.
- Keep exact replay, continuation from a checkpoint, and a new experiment as distinct player actions with distinct provenance.
- Prefer player-controlled browser-local storage and portable backups initially. Disclose storage eviction, device limits, compatibility boundaries, and whether anything advances while the page is closed.
- Preserve a recognizable world identity and factual family history so returning means discovering changes in the same world, not silently starting a replacement.
- Keep inference optional and bounded. A longer observation horizon must not silently create unbounded model calls, storage growth, or operating cost.

**Feasibility gate:** estimate the implementation and ongoing maintenance before selecting a slice. Measure sustained populated-world simulation and rendering, memory and history growth, checkpoint size, and mobile behavior. Demonstrate complete-state save/resume equivalence against an uninterrupted control and define the replay/version migration boundary. If this requires a substantial new game or service, defer it rather than describing it as a small extension.

### 3. Deepen discovery without overstating evolution

- Test whether supported conditions produce distinguishable, understandable trajectories rather than repetitive outcomes with different final counts.
- Diagnose resource, energy, feeding, reproduction, and extinction behavior before adding new mechanics; do not manufacture coexistence to make worlds look successful.
- Distinguish bounded inherited variants from new ecological species. New roles, relationships, or species-creation rules require an explicit mechanics proposal and replay review.
- Keep long-lived worlds interesting through observable consequences, not fabricated narratives or decorative changes presented as autonomous adaptation.

**Acceptance:** compare a documented cohort of valid worlds with controlled seeds and clearly identified policy regimes. Retain extinction and uninteresting outcomes as evidence. Assess legibility, meaningful differences, stability, and sustained performance separately; do not claim biological validity from deterministic replay.

### 4. Evaluate reasons to return before expanding scope

- Distinguish voluntary changed-condition experiments, exact replays, reopened saved records, and resumed living worlds when assessing usage.
- Separate within-visit continuation from later return. Simulation hours can include idle playback and are not active player engagement.
- If usage measurement is separately approved, keep player prose, world names, replay payloads, and private notes out of analytics. Do not add accounts, cloud sync, or tracking as part of this roadmap change.
- Preserve the existing free game and MIT-licensed source. This track does not authorize access restrictions, licensing changes, checkout, advertising, or hosted-service obligations.

**Decision gate:** prioritize the smallest verified improvement that makes experimentation or returning to a world meaningfully better. Do not proceed with exports, curated packs, batch exploration, or a downloadable wrapper merely because they are easy to package; each would need its own demonstrated player benefit.

### Research context and limits

Comparable accounts motivate investigation, not a claim that the same audience will choose LifePot:

- A [Sandboxels buyer](https://steamcommunity.com/profiles/76561198736973910/recommended/3664820) explicitly describes enjoying experimentation with elements. An [Ecosystem buyer](https://steamcommunity.com/profiles/76561198028761538/recommended/1133120) reports enjoying a relaxed experience but expresses price sensitivity. These are self-reported purchases, not independently verified receipts.
- A [Bibites player](https://steamcommunity.com/profiles/76561198038991433/recommended/2736860/) describes an aquarium running almost continuously. [Ecosystem player accounts](https://steamcommunity.com/app/1133120/reviews/?browsefilter=toprated) describe returning to inspect changes, alongside complaints about fixed roles and repetitive outcomes. These are qualitative accounts; purchase status is not independently verified and logged hours can include idle simulation.
- No willingness to pay, retention uplift, implementation schedule, or revenue forecast for LifePot has been established by these comparisons.

## Standing constraints

- Deterministic code owns simulation mechanics.
- Model output stays typed, bounded, validated, and auditable.
- Replay compatibility is explicit and engine-versioned.
- Extinction remains a valid outcome.
- No roadmap item may be documented as shipped before implementation and verification.

Propose scoped work through [GitHub Issues](https://github.com/tugrulguner/lifepot/issues). Discuss contract changes before implementation.
