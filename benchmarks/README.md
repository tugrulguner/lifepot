# Runtime council benchmark

From the repository root:

```sh
LIFEPOT_BENCHMARK_OUTPUT="$PWD/runtime-council-benchmark.json" \
  npx vitest run --config benchmarks/vitest.config.ts
```

`baseline.ts` is the literal council service at diagnostic-only commit `ccbb3cd7be60fdeb002ea551db44e6ef5872aa0d`. The benchmark imports the current service independently and runs both through the same controlled provider corpus. Shared game/schema dependencies come from the current checkout; this is a council-protocol comparison, not a whole-repository historical performance comparison.

The matrix uses 2, 4 and 6 specialists, ten valid/recoverable/terminal failure scenarios, alternating baseline/candidate order, 50 warmups and 500 measured samples for local validation overhead. A separate matrix uses two warmups and 20 samples with a simulated 10 ms delay per provider request. The diagnostic sink is muted equally. Every accepted result is reconciled against its rule graph; request bounds, token totals and unchanged ecology are asserted.

The output includes p50/p95 wall time, outcomes, actual provider calls, reservation attempts and serialized decision size. No real provider is contacted. The simulated-delay results are **not** Jev latency estimates, and injected failure recovery is **not** a natural failure-rate estimate. Real Worker tests and a finite live latency cohort must be recorded separately, with the tested source/artifact fingerprint and origin.

Standard unit tests intentionally do not execute this benchmark. Its generated JSON should stay out of source commits.

## Renderer and final-image checks

Run from the repository root after `npm ci`:

```sh
node benchmarks/renderer-comparison.mjs --sizes 351,601 --dpr 1 --samples 9 --warmups 2
node benchmarks/renderer-comparison.mjs --sizes 351,601 --dpr 2 --samples 9 --warmups 2
node benchmarks/result-image-parity.mjs
```

`renderer-comparison.mjs` extracts the literal complete `draw` functions from the pinned base (`116a7d311e3ef10123f74a110e1de477acce0900`), original PR (`17e006065338f876bfb9c6912e60d7b020a0c246`), and current checkout with TypeScript's AST. Its recorded-engine fixture uses seed `684946020`; pass `--config <path-to-config.json>` to supply a captured configuration and assert the expected completed endpoint (population 1,092; births 2,675; deaths 1,609; kills 1,269). The config file stays external and is not part of this repository. Without it, the script uses the deterministic default configuration. The five-role, 2,500-cell fixture is synthetic and labeled separately.

Each version paints into Chromium Canvas and performs `getImageData` readback. Reports include first paint in the shared page/module context (not cache-cold), alternating source order, redraws across distinct states advanced by the real engine (the script asserts one distinct generation per sampled state), repeated event redraws with selection/family/species focus, median and p95 sample times, canvas CSS size, and DPR. Engine stepping, app scheduling, and compositor work are excluded; this is renderer timing, not whole-app FPS or physical-device evidence. Timings are diagnostic, not brittle CI thresholds.

`result-image-parity.mjs` builds two valid graphs (four species, then two) covering all five roles, calls the production `buildResultImageModel` and `createResultImageBlob` path in Chromium, decodes each PNG, and compares each expected cell's foreground mask against an independent `traceOrganism` contour rendering. Each cell must reach at least 0.99 intersection-over-union with no more than four differing pixels; the former palette-pixel-only check could pass for unrelated shapes. It writes `.local-evidence/result-image-parity.png` and `.local-evidence/result-image-parity-omnivore.png` by default; pass a different output path as the first argument to change the first file (the second receives the `-omnivore` suffix). PNG and timing outputs are evidence artifacts, not source files.
