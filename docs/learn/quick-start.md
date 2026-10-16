# Quick start: play your first world

LifePot is a bounded, replayable artificial-life game—not a biological forecast. You can play without installing anything or supplying an API key.

## Open the game

From the [LifePot overview](/), choose **Explore this example** to enter the recorded pond immediately, with no setup questions or new inference. The landing preview is real recorded gameplay, not a live simulation. Its video stays unloaded under reduced-motion or data-saving preferences until you choose Play preview. Inside the example, optional tips explain pausing, inspection and family following; you can dismiss them.

Choose **Create your own world**, or open [/play](/play), for the three-question setup. **Explore deterministic preset** remains available there as a reviewable starting configuration. This preset is not evidence of a live Jev interpretation.

Review the proposed resources, hazard, species roles and food web before selecting **Seed ecosystem**. Initial conditions do not guarantee survival. For your own question, answer the three setup prompts instead; review the interpretation and its provenance before seeding. An unresolved fidelity review remains blocked rather than being silently approved.

## Observe a generation

New worlds start at **Slow**, targeting one generation per second; the landing example starts at **Normal**. Use the **Speed** selector to choose Normal or Fast when you want to move through the run more quickly. Speed changes timing only; it does not change the world rules or replayed result.

Watch population, resources and the generation counter. Pause before selecting a living organism in the Creature Inspector. Follow its family to examine lineage context, or use the World Observatory for aggregate measurements. Resume to watch what changes. Selection observes the world; it does not change its rules.

The deterministic engine owns movement, feeding, reproduction, mutation and death. Jev can propose only bounded, validated choices. A fallback or abstention is not a live model decision. The run ends at extinction or its observation horizon; completion is not proof that your idea succeeded.

## Try a second experiment

Read [observations and outcomes](/learn/observe-and-inspect), then [experiments and comparisons](/learn/experiments). Review a fixed-rule baseline when you want to hold the runtime policy steady; changing multiple conditions or making fresh adaptive decisions is exploratory, not a controlled causal claim.

Use a completed run's challenge/replay controls to inspect recorded behavior. [Replay](/learn/replay) reproduces recorded rules and choices without new interpretation; it does not establish biological accuracy or guarantee compatibility with every historical engine.

## Run locally

Clone the [repository](https://github.com/tugrulguner/lifepot), enter its root, and use its locked dependencies:

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Next.js, then visit `/play`. A server-side model key is optional; absent credentials use the game's labeled fallback paths. Never put provider credentials in browser code. [Deployment and protection](/learn/deployment) explains the Cloudflare build and inference boundaries.

Continue with [setup and review](/learn/setup-and-review), [developer contracts](/learn/contracts), or the [deterministic engine internals](/learn/engine-internals).
