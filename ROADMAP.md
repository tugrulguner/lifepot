# LifePot roadmap

This roadmap describes direction, not shipped behavior. The README's “What ships today” section remains the public product contract. Roadmap changes do not authorize runtime changes, deployment, or a promise of delivery dates.

## North star — create worlds that develop their own histories

Build a creative living-world sandbox where someone can describe an ecology they are curious about, give that description an understandable working interpretation, shape its conditions and discover what its inhabitants actually do. Start with simple mechanisms and investigate how their local interactions can sustain patterns, ecological relationships and evolving ways of living. The long-term ambition extends toward richer organization, social groups, culture and possible civilizations.

The article *Game of Life: how simple rules give rise to complex worlds* supplies the conceptual direction: local rules can produce organization that is not named in those rules; reproduction can preserve information; inherited variation and environmental conditions can change what persists. LifePot explores those questions through playable software. It does not currently explain the origin of life or reproduce the capabilities demonstrated by other artificial-life systems.

Civilization is a research direction, not an existing capability or an inevitable final level. Biological evolution is not a ladder toward intelligence or civilization. Worlds may remain simple, diversify, stabilize, collapse or go extinct. Preserve open-ended creation, observation and optional experimentation; do not force every player into survival, optimization or civilization-building objectives.

### Why participate rather than watch a recording?

The primary gameplay promise is **make a world, shape its conditions, and discover a history that belongs to it**. Creation, consequential experimentation and attachment are the motivations to develop, not established retention findings:

- **Authorship:** express an idea, inspect how it becomes an ecology and recognize the intended inhabitants and relationships in the world. Different requests must create meaningfully different possibilities, not merely different labels over similar fields.
- **Discovery and mastery:** form an expectation, make an understandable change and learn from the response. Outcomes need enough consistency to learn and enough interaction to surprise. Neither arbitrary noise nor a predetermined success sequence supplies this.
- **Attachment:** recognize places, families, relationships or organized patterns and follow what happens to them. Names, ancestry IDs and counters support continuity; distinctive activity and consequential history must give that continuity meaning.

These motivations should reinforce one another: create a world, encounter something unexpected, choose what to follow, optionally influence conditions, recognize the consequences and decide what to explore next. Watching without intervention remains legitimate play. Following a family is one entry point, not the entire game.

The first session must be worthwhile with simple life. More capable evolution or eventual civilizations must deepen an already useful experience rather than act as a distant reward for uninteresting waiting. A simulation achievement that is as satisfying in a video has not, by itself, established a reason to play.

### Simple-to-complex emergence is a first-class track

Keep two connected questions explicit:

1. **Emergent organization:** can local interactions produce a persistent or recurring higher-level pattern whose complete behavior was not prescribed? Investigate how it forms, changes and persists through turnover in its parts.
2. **Evolution:** can inherited differences change population behavior and reproductive outcomes, and eventually support capabilities absent from the ancestors?

Neither establishes the other. A moving pattern can exist without heredity; mutation of a few numerical traits does not establish richer organization, new capabilities or open-ended evolution. More organisms, more traits, a longer run or generated narration are not substitutes for either question.

Design enabling mechanisms and costs rather than desired outcomes. Resource interactions, signaling, environmental modification or evolvable local behavior are possible research mechanisms, not a commitment to implement them all. Do not direct cells into a predetermined structure, assign a group label to proximity, rescue a favored lineage or trigger a new civilization sprite at a population threshold. Environmental selection can favor some inherited differences without the engine granting particular identities special treatment.

Each research slice must name a concrete player-visible possibility and pass two separate gates: explain the higher-level result through actual local mechanisms and controls, and make the result noticeable and worth investigating in play. Start from observed limitations of the world rather than an indefinite sequence of engine features.

### Jev connects intention to supported conditions

Jev interprets player descriptions and proposes permitted external changes. Typed, validated choices select from mechanics the engine actually implements; unsupported requests remain explicit approximations or refusals. Jev does not generate missing physics or supply intelligence that has evolved inside the inhabitants.

Keep external intervention, mutation, selection, evolution, individual learning and trained local rules distinguishable. Disclose the configured authority and proposer/authorizer for each intervention. The shipped engine's broader council policies must not be described as environment-only; a narrower experimental mode must state its own boundary. LifePot does not currently implement ASAL's visual-search loop. Neither resemblance to living forms nor a model's explanation proves a biological mechanism.

## Where we stand

- Shipped foundations include ecological simulation, inherited variation, organism/family inspection, bounded reviewed player interventions, recorded replay, saved completed-world records and experiment comparison. Agency is not an unstarted feature.
- PR100 (merged as `344433c`) ships fixed-rule creation/preview for three authored starter ecologies. The current player guide also documents readable resource measurements, recorded family fate at endings, and an edited follow-up comparison, including a same-seed, single-condition fixed-rule path with provenance and limitations. These are useful shipped parts of the journey, not completion of M1.
- These foundations do not yet establish a compelling general-player experience, professional whole-session visual presentation, or repeat-play appeal.
- Local, unshipped work connects recorded-moment inspection to reviewed follow-up trials and comparison. Desktop/mobile functional checks include a third trial. This proves flow correctness, not enjoyment.
- Local, unshipped work adds an explicit bounded fixed-rule longer-observation core. This is not a complete persistent habitat: browser storage, resume experience, compatibility and sustained visual qualification remain gates.
- A separate local evolution candidate implements costly inherited foraging traits, mutation, accounting, replay/checkpoints and bounded reviewed environmental proposals. Fixed two-run flows and mocked-proposal acceptance have browser evidence, alongside unit checks. This establishes a narrow playable experiment, not compelling emergence, new capabilities, live-provider acceptance or a production-ready replacement for the existing ecology.
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

Only advance toward richer behavior, diversification, social organization or culture after this milestone establishes useful dynamics. Record a go/no-go decision and the evidence for extending, replacing or retaining the current engine. The narrow candidate is a baseline for this decision, not the product's ceiling or a reason to postpone Priority 1. This roadmap authorizes none of those runtime changes by itself.

### Next research gate — persistent spatial organization

The first concrete target is persistent or recurring spatial organization arising from local feeding, depletion, regeneration and movement, such as a resource/population patch or moving feeding front that remains identifiable through organism turnover. Investigate the existing feedback mechanisms first, alongside the gameplay slice. Starting resource clusters, a frozen surviving group or a single attractive frame do not establish self-maintained organization.

Record spatial resource/occupancy trajectories, organism identities and turnover. Test whether the pattern emerges after initialization and persists or recurs beyond the initial arrangement. Define its identification and persistence measure before the comparison; compare with the relevant feedback removed or with a matched spatial control across retained seeds. Report negative results. The target is a research question, not a guarantee that every world forms a pattern.

If the existing rules cannot support this target, document that limit and select one bounded local-feedback mechanism from the evidence before implementation. Inherited local action rules or environmental modification remain candidates, not a commitment to both. Do not substitute an unrelated controller feature or another trait counter for the spatial-organization target.

For the selected mechanism:

- Define local information, actions, costs, inheritance where applicable, and interaction rules without naming the desired whole-world outcome in the transition logic. State what is deliberately designed and what is claimed to emerge.
- Name the player-visible possibility before implementation: what can the player create, notice, influence or learn that was unavailable before? A more expressive genotype or a better benchmark alone does not answer this.
- Identify the higher-level behavior or organization to measure, its formation and persistence, and its dependence on interactions. Use appropriate mechanism-disabled, shuffled, mutation-disabled or environmental controls, rather than claiming causality from one attractive run.
- Preserve full histories needed to reproduce the result and retain unsuccessful seeds. Distinguish a behavior found by engineered initial conditions, offline optimization, inherited selection or external intervention. None is automatically evidence of the others.
- Inspect the real populated scene and its performance on mobile and desktop. Require a recognizable new situation with understandable consequences, not merely a changed trait mean or narration.

Extend, revise or reject the mechanism on this paired scientific/gameplay evidence. No commitment to a neural controller, continuous cellular automaton, GPU engine or new language follows from the article's examples.

## Priority 1 — create, shape and discover a living world

The next product deliverable is one connected gameplay slice: **describe or choose an ecology → review its working interpretation → enter a readable living world → follow something distinctive → optionally influence conditions → recognize the outcome → pursue a different possibility**. Use the richer existing ecology as the product starting point. Keep the separate evolution candidate isolated until its mechanics and experience justify integration; do not replace food webs and creation with a single forager merely because that prototype has cleaner boundaries.

### Immediate authorship

- Open on an attractive inhabited scene with a few contrasting starting ecologies and a prominent describe-your-own path. Start with resource-feeders competing for food, hunters with prey, and recurring scarcity as candidate configurations using supported mechanics. Qualify their actual behavior before adopting them as starters; these names promise conditions, not scripted stories.
- Make prose creation optional, not an obligatory form. Preview the actual inhabitants, directed feeding relationships and environmental pressures in player language before starting. Preserve the ability to revise an interpretation and expose unsupported intentions before seeding.
- Keep free fixed-policy exploration useful without model availability. Distinguish a deliberate preset from a degraded interpretation; never silently substitute a seedable fallback for a rejected requested ecology.

- **First authorship range:** supported inhabitants and directed feeding links, resource abundance/distribution, and pressure/variability are separate creative dimensions. Verify that changing each relevant dimension changes the actual initial state or executed relationship, not only interpretation text. This is a bounded ecology creator, not arbitrary rule generation. Expanding that range requires a new implemented capability, independently of better Jev interpretation.

### Discover intentions through play

- Make spatial feeding, movement, reproduction, resource pressure and losses readable at ordinary speed. Counts support the scene; they must not substitute for it.
- Help players notice a family, a species relationship, a local situation or a recurring spatial pattern worth following. Preserve recognizable identity, location and factual history through inspection and turnover. Do not assume ancestry alone supplies attachment or label a cluster as cooperation.
- Give the player something understandable to do or investigate before advanced emergence occurs. Teach the meaning of available actions through visible feedback, without requiring raw trait tables or a scientific protocol. Leave quiet observation valid.

### Consequential environmental choices

- Connect existing optional interventions to an observed situation, clear scope, previous/proposed conditions, timing and bounded authority. A choice should expose a tradeoff or uncertainty worth exploring, not always be presented as a beneficial upgrade.
- Keep the habitat visible while requesting, reviewing and applying a change. Show actual activation and restoration separately from ecological consequences; a temporary condition restores the setting, not the previous organisms or population.
- Let Jev interpret player intent within the available menu. Never manufacture a biological cause or model rationale absent from evidence. Preserve explicit authorization, finite inference budgets and no automatic population rescue.

**First toolset:** creation exposes supported inhabitants/feeding links, initial food abundance (scarce, balanced or rich), and supported pressure/variability settings. During a run, provide editable request shortcuts for drought, nutrient bloom and stability, alongside the existing free-text request. Drought reduces resource regeneration; nutrient bloom increases it; stability reduces the hazard contribution. Explain those implemented effects rather than implying that stability removes every hazard or that a bloom benefits every inhabitant. These are global environmental requests, not cell brushes or commands to organisms. Jev can return a different supported interpretation or abstain; the preview must show the actual proposed pressure before the player accepts it. Do not claim a shortcut directly applied its label.

Keep the existing six-generation temporary duration, next-boundary activation, previous-pressure restoration and shared limit of eight accepted council/player events for this slice. Preserve the existing request quotas independently of accepted-event counts; failed or dismissed proposals must not enable unbounded inference. No extra action currency, survival score, automatic retry or guaranteed rescue is introduced. Presets and fixed observation work without paid inference; provider qualification is a separately authorized gate.

### A history with a next possibility

- Make endings a concise factual account of the followed subject, important recorded changes and player interventions. Keep the final world inspectable; population totals alone do not settle the player's question.
- Offer a reviewable branch from the same initial world with a chosen change, or a genuinely contrasting new ecology. Carry the motivating observation into the preview and comparison instead of automatically toggling food abundance. One-condition causal investigations must disclose any other changed configuration or intervention history.
- Distinguish branching, replay and continuation. Preserve the existing baseline and seed for controlled branches; a third trial must use the second trial's reference rather than stale first-run state. Same-world continuation remains subject to Priority 4's separate contract.

**Experience gate:** complete ordinary-speed desktop and mobile sessions through a meaningful follow-up across the adopted starters, retaining quiet, unsuccessful and extinct runs. Assess what is enjoyable or useful to do before complex life appears; whether players can form intentions, understand choices, recognize consequences and carry knowledge into another world; and what participation offers beyond watching a recording. Use disciplined own play now; external player recruitment is not a prerequisite. Human enjoyment and retention remain unproven until separately evaluated.

For every adopted starter, retain a session record with the actual configuration/seed, selected subject or situation, a player intention, an available action or deliberate decision to observe, visible feedback, the observed outcome, and a specific reason to continue or create differently. A chain with no recognizable feedback or next possibility fails the experience gate even when all controls work. If a starter repeatedly offers indistinguishable play, revise or reject that starter rather than manufacturing dramatic outcomes or adding narration. Mark scripted functional tests and mocked proposals separately from ordinary-speed observation and live Jev evidence. Passing this gate means the defined journey was demonstrated in agent-led evaluation, not that human enjoyment or retention was proved.

**Implementation order:** connect creation and interpretation to the actual scene, integrate readable interactions and optional choices, finish the subject-centered ending/branch, then qualify the complete artifact and deliver a reviewed change. Build on existing renderer, authority, evidence, replay and comparison contracts. Reuse preserved journey work selectively after review; do not bundle unrelated longer-habitat work. Gameplay, visualization and bounded emergence experiments advance together; another standalone helper or engine rewrite is not the next product milestone.

### Delivery sequence and continuity commitment

- **M1 — playable creative ecology:** PR100 ships the fixed-rule starter creation/preview slice. The player guide also documents readable resource measurements, recorded family fate at endings, and an edited follow-up comparison, including a same-seed, single-condition fixed-rule path with provenance and limitations. This is partial M1 progress, supported by the bounded agent-led fixed-starter gameplay gate, not a completed milestone. Still outstanding are qualification of the full journey with optional interventions and whole-session visualization beyond that fixed-starter gate, including first-toolset shortcuts and clear in-context review/application feedback. M1 retains the existing observation bound; a bounded run is an ended observation, not evidence the ecology reached a natural final state. M1 can be delivered before same-world continuation, but does not close the continuity goal.
- **M2 — the same world continues:** next deliver opt-in, explicitly fixed-policy new worlds with a versioned bounded observation window, exact pause/save/reload/resume and an explicit action to extend observation within a published hard cap. Preserve the full state, IDs, history and any supported authority/event progress; never silently convert a legacy completed run or discard active effects. No new model calls or budget refill occur through continuation. Extinction remains terminal. Unsupported adaptive histories remain inspectable/replayable rather than being relabeled as fixed continuations. Priority 4 defines the engineering gates and is a dependency of M2, not an indefinite deferral.
- **R1 — spatial organization evidence:** run the bounded research target above alongside M1/M2. Publish a go/no-go assessment identifying any demonstrated organization, controls and failure cases. A negative result does not block independently useful gameplay delivery, but it prevents calling the emergence target achieved; a new mechanism requires a separate scoped decision and review.

Merge readiness for each implementation change requires exact-head review, CI and the applicable native-browser/Worker gates. Keep M1, M2 and R1 evidence distinct; shipping M1 does not imply continuity, emergence or civilization is delivered.

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
