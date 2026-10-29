# LifePot roadmap

This roadmap describes direction, not shipped behavior. The README's “What ships today” section remains the public product contract. Roadmap changes do not authorize runtime changes, deployment, or a promise of delivery dates.

## North star — watch life develop a history

Build a living-world sandbox where players can start with simple life, follow its descendants, optionally shape conditions, and discover how populations and their ways of living change. The long-term ambition is to explore whether worlds can develop increasingly complex behavior, social groups, culture and eventually civilizations.

Civilization is a research direction, not an existing capability or an inevitable final level. Biological evolution is not a ladder toward intelligence or civilization. Worlds may remain simple, diversify, stabilize, collapse or go extinct. Preserve open-ended observation and creation alongside optional experimentation; do not force every player into survival, optimization or civilization-building objectives.

The immediate product test is not “does the simulation run?” It is “does an ordinary session give someone something worth following, a comprehensible choice if they want one, and a reason to play again?”

## Where we stand

- Shipped foundations include ecological simulation, inherited variation, organism/family inspection, bounded reviewed player interventions, recorded replay, saved completed-world records and experiment comparison. Agency is not an unstarted feature.
- These foundations do not yet establish a compelling general-player experience, professional visual presentation, or repeat-play appeal.
- Local, unshipped work connects recorded-moment inspection to reviewed follow-up trials and comparison. Desktop/mobile functional checks include a third trial. This proves flow correctness, not enjoyment.
- Local, unshipped work adds an explicit bounded fixed-rule longer-observation core. This is not a complete persistent habitat: browser storage, resume experience, compatibility and sustained visual qualification remain gates.
- Current inherited variants are not proof of new ecological species, learned behavior, culture or civilization. Those require additional implemented mechanics and evidence.

## Foundational track — a spatial artificial-life engine

Develop this alongside the player experience and visual direction, not after cosmetic work or as an unbounded rewrite. The target is a spatial artificial-life engine with a cellular environment: cells represent environmental state, organisms have their own identity and capabilities, and any later social structures have explicit state and rules. Do not force every future mechanic into a pure cellular automaton merely because the world is rendered on a grid.

### Existing foundation and its limits

The current engine provides a fixed wrapped grid, resource and hazard fields, organism energy and age, identity and ancestry, five inherited traits, predefined strategies, and implemented feeding, movement, reproduction, mutation and death. Ecological roles and feeding relationships belong to a configured species graph. Bounded variant identifiers are not a speciation mechanism. These are real deterministic mechanics, but neither longer execution nor additional narration introduces learning, culture or construction.

### Engine contracts to establish

1. **Environment and accounting:** define the units and meaning of resource stocks, stored energy and any represented material. Specify external inputs, transport, conversion, expenditure and losses. An open ecosystem need not conserve total energy, but its sources, transfers and sinks must be explicit and tested. Terrain and environmental differences must affect actual behavior and opportunities.
2. **Heritable capabilities:** separate inherited information from current organism condition. Specify how traits produce metabolism, sensing, movement, defense and reproduction, with costs and tradeoffs. Investigate capability-driven niches and feeding relationships rather than assuming the initial role graph can express all future diversification.
3. **Behavior:** define bounded perception, available actions and action costs. Begin with understandable policies; introduce memory or learning only through an explicit behavioral contract and a demonstrated player-visible benefit. Individual learning is not genetic inheritance.
4. **Evolution and identity:** separate individual identity, ancestry, inherited similarity, ecological role and species classification. Define reproduction and mutation semantics, record reproductive outcomes, and establish criteria before claiming speciation. Do not use a reused or hashed variant identifier as evidence of a new species.
5. **Execution semantics:** document update phases, frozen versus mutable reads, random-number ownership and conflict resolution for movement, contested food, predation and births. Test ordering bias and spatial artifacts; repeatable execution alone does not establish fair or appropriate dynamics. World dimensions, topology and time step are explicit versioned model choices, not incidental renderer constants.
6. **Observation boundary:** expose immutable renderable state and factual events separately from simulation decisions. Rendering, camera changes, inspection and history sampling must not alter ecological outcomes. Event records should support explanation without inventing causes or retaining unbounded history.
7. **Runtime and authority:** keep simulation independent of React, rendering and model availability. Use bounded deterministic stepping, validated external commands, replay and complete-state checkpoints. Jev may interpret setup or propose permitted changes; it must not supply missing physics or require one model call per organism per tick.

These are responsibility boundaries, not a requirement for an ECS, a particular language, a GPU backend or premature microservices. Select implementation structure from measured needs. Preserve the current engine and supported recordings while testing a versioned candidate; refactoring alone is not evidence of richer evolution.

### First engine milestone — a playable evolutionary experiment

Build a bounded end-to-end prototype with a resource-limited spatial environment, organisms with inherited capabilities and explicit costs, reproduction and mutation, and a controlled environmental change. Let players follow descendants and see the resulting behavior and trait distributions in the actual habitat view. Keep initial conditions, engine version and interventions recorded.

**Engine gate:**

- Test resource/energy accounting, identity uniqueness, occupancy conflicts, reproduction transfers and terminal conditions on small known cases.
- Compare full-state execution, replay and checkpoint continuation; explicitly version any changed deterministic outcomes and protect supported legacy recordings.
- Compare baseline and changed-environment runs across controlled seeds, with mutation-disabled or other appropriate controls. Retain failed adaptation, drift and extinction; do not tune every case to the desired story.
- Show that inherited differences have implemented behavioral and reproductive consequences. A trait graph, phenotype color or new variant count alone does not qualify.
- Demonstrate a readable ordinary-speed playable session. Engine quality, visual comprehension and curiosity are separate acceptance criteria, and all are required.
- Measure complete populated-world stepping plus rendering, memory, history and checkpoint growth on desktop and mobile. Define supported bounds before enlarging worlds or horizons; do not substitute isolated kernel timings for the workload.

Only advance toward richer behavior, diversification, social organization or culture after this milestone establishes useful dynamics. Record a go/no-go decision and the evidence for extending, replacing or retaining the current engine. This roadmap authorizes none of those runtime changes by itself.

## Priority 1 — one compelling complete session

Make the whole experience work before expanding its duration or feature count.

- Offer an attractive inhabited starting world before requiring extensive prose setup. Keep a clear create-your-own path and a few genuinely contrasting starter ecologies.
- Establish the player promise: follow life, investigate changes, and optionally influence conditions. Explain actions in player language rather than exposing internal fallback, graph and policy terminology unnecessarily.
- Help players find a species, family or situation worth following. Keep its identity and fate connected to the habitat during ordinary-speed play.
- Make spatial feeding, reproduction, resource pressure and population changes legible. Counts support the scene; they must not substitute for it.
- Connect existing optional interventions to clear scope, timing and recorded consequences. Preserve explicit review and bounded authority; do not invent causation or guarantee rescue.
- Make endings a concise account of the world and the player's chosen subject, not just totals and an administrative generation limit.
- Carry an actual observation into a reviewable next experiment. Show the changed condition and comparison before detailed histories; a third trial must use the second trial's reference rather than stale first-run state.

**Experience gate:** complete ordinary-speed desktop and mobile sessions through a meaningful follow-up, with visible controls and genuine simulation state. Record whether the subject, turning point, optional choice, outcome and next question are intelligible. Functional tests remain necessary but do not close this gate. Use disciplined own play now; external player recruitment is not a prerequisite. Human enjoyment and retention remain unproven until separately evaluated.

## Priority 2 — professional whole-session visualization

Treat presentation as a coherent game scene, not a sequence of isolated panel improvements. Develop this together with Priority 1.

- Establish a consistent visual direction for habitat, organisms, environmental fields, typography and interface hierarchy. A strong 2D presentation is acceptable; 3D is not a prerequisite.
- Frame the world deliberately on desktop and mobile. Avoid a small habitat lost in empty space or an interface that requires constant scrolling away from life.
- Make feeding roles, selected subjects and family relationships recognizable at ordinary viewing scales. Close-up should reveal useful detail, not merely enlarge indistinct marks.
- Give movement and recorded feeding, birth, death and environmental events clear visual timing without implying unimplemented anatomy, behavior or physics.
- Design camera, inspection, intervention, ending and comparison as one experience. Preserve keyboard/touch access, reduced motion, readable contrast and existing target/habitat bounds.
- Keep diagnostics, provenance and complete histories accessible through progressive disclosure rather than allowing them to dominate ordinary play.

**Visual gate:** inspect real moving gameplay, close-up/family tracking and endings at matched desktop/mobile states. Assess composition, identity, event readability and attention continuity together. Benchmark actual populated simulation plus rendering. Screenshots, artwork atlases and renderer microbenchmarks alone cannot establish the whole-session result.

## Priority 3 — make evolution observable and mechanically real

Evolution should be something players can recognize across descendants, not a counter, cosmetic change or narrated claim.

- Audit existing inheritance, mutation, energy, feeding and reproduction before adding complexity. Distinguish changes within an individual's lifetime from heritable population change across generations.
- Show ancestry and observed trait distributions over time, including tradeoffs and lineage loss. Distinguish measured change from a hypothesis about selection; do not infer adaptation from a single successful organism.
- Test whether contrasting environments produce distinguishable heritable trajectories across controlled seeds. Preserve negative results, drift, extinction and repetitive outcomes as evidence rather than tuning every world toward a success story.
- Investigate richer evolvable traits and behaviors only with explicit costs, inheritance, mutation and ecological consequences. Keep visible traits tied to implemented state.
- Treat ecological diversification and speciation as separate design work: define what constitutes a species, how separation persists, and how new roles or relationships arise. A bounded variant identifier is not a new species.
- Make changes understandable at both organism and population scales without requiring players to study raw trait tables.

**Evolution gate:** demonstrate complete recorded ancestry and phenotype changes, their implemented effects and reproducible environmental comparisons. Validate resource/accounting invariants and replay compatibility. Describe this as evolution within a toy model, not a simulation of the origin of life or scientific proof of particular evolutionary outcomes.

## Priority 4 — a world worth returning to

Persistence should preserve attachment and ongoing questions established by the experience above. More generations alone do not create return value.

- Distinguish exact replay, a new experiment and continuation of the same paused world in both UI and provenance.
- Finish an opt-in, bounded browser-local habitat contract before proposing indefinite worlds. The current local candidate is fixed-rule observation up to 1,800 generations; the shipped 180-generation contract remains unchanged until a versioned implementation is delivered.
- Preserve complete deterministic state, random-number state, identities, evidence, engine version and applicable authority/budget state across pause, save, reload and resume.
- Begin with explicit no-offline-advance semantics. Never imply that life changed while the browser was closed when no simulation ran.
- Retain recognizable world identity and factual family history. Offer portable backups and explain eviction/device/compatibility limits without making storage administration the main experience.
- Keep inference optional and bounded; longer sessions must not silently refill budgets or create unbounded costs.

**Continuation gate:** compare complete restored state and subsequent execution with uninterrupted controls; test browser reload, corrupt/incompatible saves, quota failure and early extinction. Measure sustained populated simulation/rendering, checkpoint size, memory and retained-history growth. Qualitatively verify that returning resumes a meaningful subject or question, not merely a longer timer.

## Long-term research — from life to possible civilizations

The ambition is a connected history from simple beginnings, not disconnected mini-games labelled as evolutionary eras. The following are research stages, not a mandatory progression or implementation commitment. Each needs a bounded playable prototype and explicit go/no-go review before expanding the production engine.

### A. Adaptive behavior and learning

Investigate sensing, memory and behavior with actual survival/reproduction costs and ecological consequences. Distinguish inherited behavior from individual learning. Establish whether these mechanisms create readable new situations, rather than opaque agents or expensive model calls for every organism.

### B. Social organization

Investigate repeated interactions, communication, cooperation, competition and stable groups. Require observable mechanisms and tradeoffs; proximity or a “tribe” label alone does not constitute social organization. Allow groups to dissolve and strategies to fail.

### C. Culture and cumulative knowledge

Investigate socially transmitted information or skills that can persist beyond one individual's lifetime, vary between groups and be lost. Keep cultural transmission separate from genetic inheritance. Test whether knowledge actually changes behavior and material outcomes; generated stories are not simulated culture.

### D. Settlements and civilizations

Only after the preceding foundations are useful and tractable, investigate persistent shared construction, resource production/storage, specialization, exchange and collective coordination. Define an operational meaning of “civilization” for the game before claiming emergence. Settlements must arise from implemented actions and constraints, not a population threshold that swaps sprites or announces a new era.

Preserve ecological dependency, historical continuity, failure and multiple possible social forms. Do not promise a universal path, human-like civilization, a historical reenactment or an inevitable technological endpoint.

**Research gates for every stage:**

- Specify agent capabilities, environment, resource/energy costs, inheritance or learning rules, and observable evidence of the claimed phenomenon.
- Demonstrate a small end-to-end playable example and contrasting controls; distinguish designed enabling conditions from self-organized outcomes.
- Determine whether it strengthens player curiosity, agency and visual understanding before adding the next layer.
- Measure long-horizon execution, rendering, storage and any inference costs; maintain bounded authority and reproducible records.
- Version deterministic changes explicitly and preserve supported recordings or reject unsupported contracts clearly.
- Decide whether the stage belongs in LifePot, an experimental mode or a separate project. Do not quietly turn the existing small browser game into an unbounded civilization-engine rewrite.

## Delivery and evidence

- Track experience milestones across changes. A merged helper, passing test suite, functioning comparison or checkpoint prototype does not close a gameplay milestone.
- Keep shipped, local implementation, research prototype and proposed direction visibly separate. Do not repeatedly reset existing features as “not started.”
- Required engineering gates remain strict: deterministic mechanics, typed validated model authority, provenance, replay rejection, privacy, desktop/mobile accessibility and actual deployment verification.
- Judge repeated play separately from later return, exact replay, reopened records and resumed worlds. Idle simulation time is not active engagement.
- If analytics is separately approved, exclude player prose, world names, replay payloads and private notes. No accounts, tracking, cloud sync, monetization or licensing changes are authorized by this roadmap.
- Preserve free observation and creation. Do not substitute compulsory missions, fabricated success scores, automatic population rescue or retention chores for an interesting world.

### Research context and limits

Comparable accounts motivate investigation, not a claim that the same audience will choose LifePot:

- A [Sandboxels buyer](https://steamcommunity.com/profiles/76561198736973910/recommended/3664820) explicitly describes enjoying experimentation with elements. An [Ecosystem buyer](https://steamcommunity.com/profiles/76561198028761538/recommended/1133120) reports enjoying a relaxed experience but expresses price sensitivity. These are self-reported purchases, not independently verified receipts.
- A [Bibites player](https://steamcommunity.com/profiles/76561198038991433/recommended/2736860/) describes an aquarium running almost continuously. [Ecosystem player accounts](https://steamcommunity.com/app/1133120/reviews/?browsefilter=toprated) describe returning to inspect changes, alongside complaints about fixed roles and repetitive outcomes. These are qualitative accounts; purchase status is not independently verified and logged hours can include idle simulation.
- No willingness to pay, retention uplift, implementation schedule, or revenue forecast for LifePot has been established by these comparisons.

## Standing constraints

- Deterministic code owns simulation mechanics; model output remains typed, bounded, validated and auditable.
- Models may support interpretation and bounded decisions, not manufacture unimplemented evolution or civilizations through narration.
- Replay compatibility is explicit and engine-versioned.
- Extinction, simplicity, divergence and collapse remain valid outcomes.
- Preserve the free game and MIT-licensed source.
- No roadmap item may be documented as shipped before implementation and verification.

Propose scoped work through [GitHub Issues](https://github.com/tugrulguner/lifepot/issues). Discuss contract changes before implementation. Experience milestones govern priorities; technical slices serve them rather than replacing them.
