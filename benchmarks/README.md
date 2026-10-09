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
