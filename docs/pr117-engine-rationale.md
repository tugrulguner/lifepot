# PR117 engine calibration rationale

## Scope and roadmap fit

PR117 introduces the versioned `lifepot-ca-9` mechanics while retaining explicit ca-7/ca-8 contracts. That separation matches ROADMAP.md's requirement to version changed deterministic outcomes and preserve supported recordings. The changes also address the roadmap's accounting and heritable-capability questions: births transfer parental energy; predation credits a bounded share of captured energy; metabolism and mobility traits now carry costs as well as effects. This is a toy-model mechanics change, not evidence of biological calibration, adaptive evolution, speciation, or persistent organization.

## Founder counts: a material starting-condition change

For a balanced world, ca-9 seeds 24 basal feeders and 6 hunters per corresponding species, versus ca-8's 18 and 8. The implementation retains balance scaling for prey-heavy/predator-heavy settings. This materially shifts the starting trophic ratio, so comparisons across engine versions are not controlled comparisons of only the changed feeding or trait mechanics. A change in coexistence across versions cannot be attributed to the founder ratio alone. To isolate that effect, hold the rules, intake, environment and seeds fixed and vary only the initial counts. Include extinctions as well as surviving runs.

The regression pins the counts and verifies that ca-8 retains its old counts. It does not establish that 24:6 is more realistic or that it improves any desired outcome. Keep both balance settings and negative/extinction outcomes available; do not use coexistence as the calibration target.

## Feeding and accounting

The current tests exercise per-step energy accounting: cooperation/mutualism cannot manufacture energy; offspring receive energy transferred from parents; predation gain is limited by captured prey energy and matches the feeding event; legacy negative-cost reproduction remains covered. These are mechanistic invariants, not evidence that the intake rates, costs, or predation shares are empirically calibrated. ca-9's basal intake, resource growth, hazard divisors, founder counts and other constants remain explicit toy-model parameters.

## Trigger claims

The ca-9 trigger regressions establish two narrow properties: the tested default one-grazer world does not classify its initial regrowth ramp as a resource shift, and sampled default worlds do not classify early ordinary kills as a predation spike before a full prior 12-generation comparison window exists. The detector then requires recent kills to clear its absolute threshold and exceed the preceding 12-generation kill count by 1.5x. These tests do not show trigger precision/recall over broad ecologies, nor that every genuine resource shift or predation outbreak is detected. Older engine versions retain their original trigger thresholds for replay compatibility.

## Verification boundary

`src/game/engine-versions.test.ts` verifies full-run hashes for ca-7 and ca-8, ca-9 determinism, selected regrowth and trait-cost contrasts, founder counts, and the narrow trigger cases above. `energy-accounting.test.ts`, `coevolution.test.ts`, and `mechanics.test.ts` add focused mechanical checks. No cohort dataset or cohort runner was found in the repository during this audit; therefore claims about cohort-wide outcome rates cannot be independently verified from checked-in evidence. ROADMAP.md's proposed controlled-seed environmental comparisons and retained negative outcomes remain future evidence gates.
