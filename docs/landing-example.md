# Recorded landing example

The landing video is a real capture of the current GameCanvas renderer replaying `public/example-world.json`. It is not a live simulation, generated animation, or fresh Jev session. The example reuses the existing `pond-notebook.json` public test recording without its library name, UUID, private notes or saved observation UI. Its original engine version, seed, conditions and complete accepted ledger remain unchanged.

The validated three-role world runs to extinction at generation 138: cumulative births 422, deaths 466 and consumption kills 328. These are recorded outcomes, not a promise for other worlds. The landing clip shows the opening through generation 56, including real births and feeding, an organism camera-follow, and a return to the full habitat. It does not show the complete trajectory or claim that camera movement changes the ecology.

## Reproduce

1. Run `node scripts/prepare-example.mjs` to copy the canonical replay and expected endpoint from the existing fixture.
2. Run `npx vitest run src/game/example-world.test.ts` to strictly validate the complete replay and endpoint.
3. Start an owned local game server. Run `node scripts/capture-example.mjs http://127.0.0.1:PORT PATH_TO_SCRATCH_OUTPUT`. The script captures the actual canvas and records observed generation/stat checkpoints plus network/error guards. It aborts if a judge/reflection request or runtime error occurs.
4. Encode its `example-raw.webm` with:

   `ffmpeg -i example-raw.webm -vf 'fps=20,scale=600:600:flags=lanczos' -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart -an public/life-example.mp4`

5. Extract a populated poster with:

   `ffmpeg -ss 2 -i public/life-example.mp4 -frames:v 1 -q:v 3 -update 1 public/life-example-poster.jpg`

The committed clip is 600 × 600, 20 fps, H.264, silent, 17.95 seconds and 744,051 bytes. It loops with a visible scene reset, rather than pretending to be continuous live play. Captured timing varies with the browser; the replay itself is deterministic.

The poster is available before video loading. Reduced motion/data-saving preferences prevent automatic video loading; explicit play opts in. Visibility and viewport changes pause playback, and a deliberate pause is retained. The landing route defers GameCanvas and disables game-link prefetch so the engine is not needed just to view the preview.

`/play#example` fetches the same bundled public recording, validates it through the existing replay decoder, and starts normal-speed replay. Optional expandable/dismissible tips explain the existing controls. Ordinary setup, old replay URLs, mechanics and inference authority are unchanged. This feature adds no accounts, storage service, usage funnel or automatic social posting.
