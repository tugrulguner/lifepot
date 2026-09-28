# Reviewing LifePot changes

Review the contract before the presentation. A visually convincing run can still be invalid, nondeterministic, or overstate model authority.

## Simulation changes

- [ ] The same accepted seed, config, engine version, and ledger produce the same snapshot.
- [ ] Randomness advances through the explicit deterministic state.
- [ ] Typed-array indices and toroidal neighbors remain bounded.
- [ ] Feeding follows the directed rule graph rather than role labels alone.
- [ ] Trait and energy writes remain within declared bounds.
- [ ] Extinction remains a valid outcome.
- [ ] Behavior changes update `ENGINE_VERSION` when old replays would diverge.

## Model-boundary changes

- [ ] Inputs are size-bounded and schema-validated before model use.
- [ ] Outputs use finite enumerations and strict schemas.
- [ ] Probabilities cover every option and agree with the selected choice.
- [ ] Model output cannot become executable code or direct state mutation.
- [ ] Missing credentials, invalid output, timeout, and quota failure have labeled behavior.
- [ ] New downstream calls are included in rate/spend accounting.

## Runtime-decision changes

- [ ] The observation is frozen and hashed before inference.
- [ ] Generation, trigger, observation hash, and graph version are bound.
- [ ] Ledger ordering, cooldown, and entry caps still hold.
- [ ] Scheduled activation, duration, transition, and patch evidence agree.
- [ ] Replay rejects missing, extra, reordered, or unreachable decisions.

## Documentation changes

- [ ] README examples match public behavior.
- [ ] Shipped and planned work are clearly separated.
- [ ] Biological and AI guarantees are not overstated.
- [ ] Relative links and image assets resolve.
- [ ] SVG sources stay beside rendered PNG assets.

## Required gates

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e

git diff --check
```

Review the exact pushed head after formatting or generated-file changes.
