# Dependency security and Worker compatibility

Next.js and its Cloudflare adapter must be qualified together. This update pairs
Next **16.4.3** with `@opennextjs/cloudflare` **1.20.13**. The older adapter cannot
bootstrap Next's `preview-props.json` manifest: prepared pages can look healthy
while missing routes and API handlers fail with HTTP 500.

## Narrow build-tool override

The adapter selects `@opennextjs/aws@4.1.12`, which selects the 9.x minifier.
`@node-minify/core@9.0.2` pins **glob 10.3.3** exactly. That version is affected by
[GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2);
the patched 10.x minimum is **10.5.0**. No patched core release satisfies the
upstream 9.x range at the time of this update. Moving the parent to core 11.x
would bypass a different major-version contract.

The manifest therefore overrides **only the glob child of core 9.0.2** to
`^10.5.0`. Other glob consumers, including the adapter's 13.x dependency, retain
their own versions. This deliberately replaces the parent's exact vulnerable
pin with a patched version in the same glob major; it is not claimed to satisfy
that original exact pin without npm's override mechanism.

The advisory concerns glob's CLI `-c`/`--cmd` shell-execution path, not ordinary
`globSync` library use. The minifier uses the latter. This update removes the
known vulnerable dependency rather than claiming a demonstrated public-game
command-injection exploit. `scripts/dependency-compat.test.mjs` verifies the
resolved patched major/minor and exercises real wildcard expansion plus Terser
compression of trusted fixtures through the actual minifier API.

Remove or revise the override and its compatibility assertion when a reviewed
adapter/minifier parent uses a patched dependency natively. Do not downgrade the
adapter merely to make an audit pass without rechecking Next compatibility.

## Other patched transitive dependencies

The npm-generated lock also selects **body-parser 2.4.0** and **qs 6.17.0** within
their declared parent ranges. No new direct application dependency is added for
either package. These address the remaining known body-parser/qs advisories;
future registry findings still require a fresh audit.

## Required checks

```sh
npm ci
node --test scripts/dependency-compat.test.mjs
npm test
npm run lint
npm run typecheck
npm run build:cloudflare
npm run test:cloudflare
npm audit
```

The default built-Worker gate includes `e2e/worker-runtime.spec.ts`: real missing
page/download 404s and malformed judge/player-proposal/reflection 400s. These
requests are rejected before provider invocation. They must run on the actual
Worker, not only Next's development server. `npm run test:cloudflare -- --all`
runs the complete built-Worker matrix, including prepared-delivery contracts.
