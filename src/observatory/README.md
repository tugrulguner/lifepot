# Approved observatory

`/play` serves the self-contained document generated from this directory. Its
entry contract is a seeded, paused world with immediate controls, not the
advanced experiment setup screen. Keep the approved template, artwork and
interaction structure together; matching renderer layers alone is not parity.

`client.js` imports the production simulation and starter-world modules. There
is no copied simulation engine. `entry.js` preserves explicit legacy example
and replay URLs by forwarding those visits, unchanged, to `/experiment`, where
the full setup, saved-world, replay and adaptive experiment application lives.
Normal `/play` visits do not take that route or call inference. App responses advertise the advanced workspace with a `lifepot-app` Server-Timing metric on the document. A standalone copy, including one served over HTTP at `/play`, has no such marker: it plays locally without following legacy redirects or offering links to missing routes.

`npm run dev`, `build`, `test` and `typecheck` generate `generated-html.ts` through
`scripts/build-observatory.mjs`. The generated module is ignored. To produce
exactly the same document as a portable review artifact:

    node scripts/build-observatory.mjs --output /absolute/path/play.html

The standalone file embeds its assets and does not require a server. Preserve
native simulation authority when changing presentation. The entry browser
regressions are in `e2e/observatory-entry.spec.ts`; the advanced workflow retains
its existing assertions under `/experiment`.
