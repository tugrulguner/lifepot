# Contributing to LifePot

LifePot welcomes focused changes that preserve deterministic execution and bounded model authority.

## Good contribution scopes

- reproducible simulation or replay bugs;
- stronger contract and invariant tests;
- accessibility and browser acceptance coverage;
- clearer inspection and decision evidence;
- bounded ecology mechanics discussed before implementation;
- documentation, diagrams, and runnable setup improvements;
- performance work measured on complete simulations.

Open an issue before implementing a new public contract, model capability, ecological vocabulary, or replay format.

## Setup

Requirements:

- Node.js 22;
- npm;
- Chromium for Playwright acceptance tests.

```bash
git clone https://github.com/tugrulguner/lifepot.git
cd lifepot
npm ci
npx playwright install chromium
```

`TYPESAFE_API_KEY` is optional. The automated suite uses controlled fixtures and deterministic fallback paths; contributors should not need provider credentials.

## Development

```bash
npm run dev -- --hostname 127.0.0.1
```

Keep secrets in `.env.local`, which is ignored by Git. Never add secrets to client-side variables.

## Required verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```

If a change modifies deterministic behavior, add a focused regression test and assess whether `ENGINE_VERSION` must change. If a change modifies a visual flow, update the Playwright coverage through stable accessible roles and names.

## Pull requests

- Keep one behavioral concern per pull request.
- Describe the invariant being changed and why.
- Separate shipped behavior from roadmap ideas.
- Include exact verification commands and results.
- Preserve editable SVG sources beside rendered PNG assets.
- Do not present model confidence as correctness or imply biological realism.

See [docs/reviewing.md](docs/reviewing.md) for the review checklist and [docs/simulation-contract.md](docs/simulation-contract.md) for the project boundary.

## Community

Use [GitHub Issues](https://github.com/tugrulguner/lifepot/issues) for reproducible work. Use the [ModePot Discord](https://discord.gg/u3AANZr6RG) for exploratory discussion and implementation questions.
