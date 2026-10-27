# Player guide: shape a world, read its history

LifePot is a bounded artificial-life game. Describe an environment, review the proposed ecology, then watch a deterministic simulation. The model may propose typed choices; it cannot write rules or control organisms. Extinction is a valid outcome, and this is not a biological forecast.

## Start from the questions

The setup asks three short questions. Each answer is trimmed, must contain 1–140 characters, and is interpreted into a fixed vocabulary—not compiled as a rule.

- **What exists in this world?** Resource abundance and distribution; phrases such as “rich,” “scarce,” “clustered,” “oasis,” “seasonal,” and “cycle” map to configured environment choices. Founder balance can also be inferred from “prey heavy” or “abundant prey.”
- **What threatens life here?** Selects a hazard (`drought`, `toxin`, `heat`, `crowding`), volatility (`stable`, `pulsing`, `chaotic`), and related pressure. “toxic,” “heat,” “competition,” “pulse,” and “unpredictable” are examples recognized by deterministic setup.
- **What should evolution favor?** Weights five priorities: `survive`, `replicate`, `cooperate`, `explore`, `adapt`. Words such as “endure,” “offspring,” “share,” “spread,” and “diversify” influence the mapping. Weights are normalized to sum to one.

The mapping is deliberately literal and limited. For example, “toxic” selects the toxin hazard, but does not create a new chemical simulation. Unmatched prose falls back to the documented defaults; it is not an instruction to the engine.

## Try the recorded preset

The in-game **Explore deterministic preset** button fills these exact answers:

```text
World: Rich mineral pools with abundant prey
Threat: Predator packs hunt through pulsing droughts
Reward: Diversify while prey and predators coexist
```

Review the resulting setup before starting. The preset is an example, not a guaranteed winning strategy. With no server API key, the game still runs using labeled deterministic fallback choices; a live interpretation may vary among allowed values.

## Review before starting

The review step exposes the generated configuration and its source/provenance. Check resource conditions, fitness weights, founder balance and strategies, and the species interaction graph. Setup establishes initial conditions; it does not guarantee population survival.

**Restart** in the running world's controls reruns the current answers, config, and seed; it is not a new randomized setup. At completion, **Change objective** returns to the third setup question; reload the page to begin again with all three answers. To share/replay an accepted completed run, use **Copy challenge link**. Replay starts from the recorded choices and seed instead of asking the model to interpret them again.

## Observe and inspect

Playback starts at **Slow**, targeting one generation per second so you can notice changes. The **Speed** selector offers Slow, Normal (the previous default pace), and Fast. Pause for close inspection, or use Step to advance one generation while paused. Speed changes playback timing, not ecological rules, decision checkpoints or recorded outcomes. Your selection stays in effect during the current visit, including restarts and follow-up trials; a fresh page starts at Slow.

The world is a 50×50 toroidal grid: movement across an edge wraps to the opposite edge. The canvas depicts organisms, species colors, and resource patches. Use **Pause** before close inspection: a paused run keeps the state stable while you select an organism. On a narrow screen, the interface stacks the world, controls, inspector, event feed, statistics, and observatory vertically; scroll to reach them.

Select a living organism to pause and inspect its current species, strategy, energy, age and family. **Inspect living organism** keeps a magnified, measured preview beside the habitat rather than scrolling away from it. Use **Pin this family** to follow its founder lineage, or **More organism details** to deliberately open the full Creature Inspector. While a cell is selected, **World activity & species** keeps the aggregate counts and current policy available in a disclosure. Resuming clears the cell inspection; the family pin remains. Selection is observation, not an intervention, and does not change the simulation.

Species focus de-emphasizes other species; selected organisms and pinned families remain bright even when they belong to a different species. The overview uses quiet resource and hazard shading, with exact-cell marks on empty cells at 2× zoom or closer. Cell inspection retains exact resource and hazard values at every zoom. White rays and a static dot mark births, gold circles mark feeding, gold diamonds distinguish recorded prey capture, and red crosses mark deaths. Marks show the recorded event location, not a reconstructed movement path or the identity of a later occupant of that cell. Transient pulses are a bounded visual sample, prioritizing observed organisms and recorded members of the pinned family, including recent deaths; feeding does not consume every priority slot. The recorded events and measured totals are unchanged. Reduced motion suppresses transient pulses. The shared organism artwork is illustrative role styling, not measured anatomy or additional mechanics. Producers use a six-lobed rosette, grazers a notched kidney-shaped body, scavengers a sloping segmented body, hunters a broad dart with a forked tail, and omnivores an asymmetric four-lobed body. Small cells emphasize body shape and species color; zoom reveals internal detail. The same artwork source supplies the habitat, role keys, inspector and final image.

The Creature Inspector sits directly below the board's species-focus controls. Its compact summary shows species, role, energy, age, and living founder-family count; Follow and Clear remain available without opening Detailed organism inspection. Detailed measurements start collapsed and can be expanded when useful. Species-focus controls stay next to the board even while details are expanded. Observed extinction milestones retains the first observed extinction generation of each configured species and of a family followed when its last member disappeared. Clearing inspection or stopping following does not remove recorded milestones; starting another run resets them. A family already absent when first followed has no observed extinction transition. These notices report what happened, not why.

The World Observatory summarizes population, prey/predator counts, births, deaths, kills, resources, species richness, lineages, and the recent ecological history. These are aggregate simulation counters, not estimates of real-world populations. The decision ledger records accepted evolution decisions and their evidence/source. A fallback entry is not Jev evidence.

## Explore with the camera

Camera controls sit below the inspector so species controls and extinction notes remain beside the board. Zoom from 1× to 3×, drag with a mouse while zoomed, or choose Full world to reset. On touch screens, enable Drag to pan before dragging the board; turn it off to scroll the page over the board. A tap without a drag still pauses and inspects the selected cell. With the board focused, +/− changes zoom, Shift+arrow keys pan, and 0 resets. Ordinary arrow-key inspection remains available.

Inspect a living organism and choose Follow organism to track its identity as it moves. Pin a founder lineage in the inspector, then choose Follow pinned family to track that family's oldest living member. When that member dies, family tracking moves to the oldest survivor; it does not claim to frame the entire family. Crossing a wrapping edge moves the camera to the opposite side. The view stays within world bounds, so organisms near an edge need not be centered. If the organism dies, the family becomes extinct, or its pin changes, the full world returns with an explanation. Stop camera follow or manual panning releases camera tracking without removing the lineage pin.

Camera panel actions return you to the board once and focus it for keyboard control. Later deliberate scrolling is preserved through playback, theme changes and target loss. A lost-target or changed-pin explanation also appears beside the board. Clearing or changing a family pin permanently releases its camera tracking; re-pinning only highlights the family until you explicitly choose camera following again.

Camera changes do not alter rules, organisms, random state or replay outcomes. Pause and theme changes preserve the view; restarting or replaying starts at full-world view. Exported result images continue to show the full world rather than the camera crop.

## Read outcomes without overclaiming

A simulation can finish as `extinct`, `surviving`, or `thriving`. Extinction means the simulated population reached zero; `thriving` is an engine-defined end state, not a biological judgment. Runs stop at generation 180 at the latest. The world may end earlier if it becomes extinct.

Resources regenerate and can be depleted; organisms feed, move, reproduce, mutate, age, and die according to engine rules. Fitness weights influence bounded mechanics; they do not promise that the named priority wins. Mutation can be neutral or harmful. The engine does not rescue a population to make a better story.

## Replay and its limits

A replay carries the engine version, canonical answers, validated config, unsigned 32-bit seed, setup hash, ordered decision ledger, and contract hash. Replay validation re-runs the deterministic engine against that ledger. It does not call the interpretation model. Modified, incomplete, reordered, unreachable, unsupported, or tampered replay data is rejected rather than “best effort” played.

Replay compatibility is versioned: a replay recorded for another engine version may be unsupported. A valid replay establishes reproducibility under its recorded engine contract; it does not prove the model's ecological explanation is true.

## If something looks wrong

- **Choices differ from what I wrote:** setup maps prose to finite values; inspect the normalized review rather than assuming every phrase has a direct mechanic.
- **The world ends quickly:** extinction is an allowed result. Try different resources, hazard, founder balance, or priorities, then start a new run.
- **No live model interpretation:** the game can use deterministic fallback. Check the displayed provenance; never label fallback as a model response.
- **Replay rejected:** check for truncation/tampering and supported engine version; replay validation intentionally rejects unsupported payloads.
- **Controls or inspector are off-screen:** pause, scroll, and use the vertically stacked mobile layout.

## Jev review and next experiments

After interpreting your setup, Jev checks the assembled species roles and food web against your original description. If its own proposal needs correction, LifePot attempts one bounded repair: Jev reselects the species and roles, then chooses feeding links against those fixed roles, and reviews the corrected graph again. Only an approved proposal can be seeded. Your answers are preserved; you do not have to rewrite them just to retry. If the correction remains unresolved, the review offers a specific model-selected area to clarify, or explains that no specific mismatch was identified. A failed correction stays blocked rather than silently becoming a fallback. You can explicitly choose the separate deterministic preset instead. The game does not silently add feeding links to make the story fit.

At runtime, the orchestrator and active scoped specialists use at most two provider requests per council observation. Specialist questions share a grouped inference request; responsibilities remain bounded, but these are not separate independent model calls. Token usage for the group is counted once. Existing separate-call replay records remain supported.

Reported adaptive abstentions distinguish rate limiting, unavailable service, invalid output, missing credentials, and unknown failures. An abstention applies no new policy; inherited behavior continues. A live setup does not guarantee every later decision is live.

Completed results include individual species histories. Edited follow-up trials compare recorded conditions, aligned species trajectories and observed extinction timing. Conditions use readable labels; the rule-graph version is bookkeeping, not a second experimental condition. Starting or replaying a trial returns you to the board once, while later deliberate scrolling is preserved. Initial environmental hazard and graph pressure are separate conditions; changing one does not remove the other. Fresh adaptive decisions can differ even with the same initial seed, so comparisons do not establish causality.

Use **Review fixed-rule baseline** at the end of a run to review the original conditions and seed with runtime AI interventions disabled. This opens an editable review; it does not start another world or relabel the earlier adaptive run. Seed the separate fixed baseline, finish it, then use **Edit this world** to change one condition for a fixed-rule follow-up. Comparisons display actual seed and policy provenance plus counts and equality of accepted Jev decision records. Record differences include timing, observation and model metadata; they do not by themselves prove a different executed policy or its effect. Adaptive trials and recorded replays remain exploratory; different or unknown seeds never support a same-seed claim. Multiple changed conditions are exploratory, while unchanged fixed trials are repeat observations. Even a same-seed, single-condition fixed comparison describes this toy model, not biological proof.

Use “Ask Jev about this run” to request a model-selected turning point and supported next experiment. Jev selects among recorded evidence and bounded condition changes; displayed measurements come from the engine. Your optional private question is not sent. “Review suggested experiment” opens editable conditions without starting a run. If the service fails, no invented explanation is substituted. Evidence remains session-local; asking Jev sends numerical evidence and configuration to the server and model for that request.

## Further reading

- [Developer reference and engine internals](/learn/developer-reference)
- [Architecture](https://github.com/tugrulguner/lifepot/blob/main/docs/architecture.md)
- [Simulation contract](https://github.com/tugrulguner/lifepot/blob/main/docs/simulation-contract.md)
- [Deployment and protection](https://github.com/tugrulguner/lifepot/blob/main/docs/deployment.md)
